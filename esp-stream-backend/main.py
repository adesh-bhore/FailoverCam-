import cv2
import time
import os
import gc
import threading
import platform
from flask import Flask, Response, jsonify, request
from datetime import timezone
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
import supervision as sv
import socket
from urllib.parse import urlparse
# --- add at top ---
import socket, statistics
from collections import deque

import uuid
from collections import deque, defaultdict
from datetime import datetime, timedelta
from flask import send_from_directory
import requests
import json



# ========= CONFIG =========
ROBOFLOW_API_KEY = "haJwmWC3X0buWEYP3krX"
MODEL_ID = "threat-detection-k4a3c/1"
PRIMARY_URL = "http://192.168.193.159:8080/video"
BACKUP_URL = "http://192.168.193.141:8080/video"  # Legacy backup URL, kept for backward compatibility

# Backup cameras configuration file
BACKUP_CAMERAS_FILE = "backup_cameras.json"
backup_cameras_lock = threading.RLock()  # Use RLock (reentrant) to avoid deadlock when save_backup_cameras is called from load_backup_cameras

# Disable heavy Roboflow models for performance
os.environ.update({
    "FLORENCE2_ENABLED": "False",
    "CORE_MODEL_CLIP_ENABLED": "False",
    "CORE_MODEL_SAM_ENABLED": "False",
    "CORE_MODEL_PE_ENABLED": "False",
    "PALIGEMMA_ENABLED": "False",
    "QWEN_2_5_ENABLED": "False",
    "CORE_MODEL_YOLO_WORLD_ENABLED": "False",
    "SMOLVLM2_ENABLED": "False"
})

app = Flask(__name__)

# Simple CORS support for frontend on localhost:5173
# Simple CORS support for frontend
@app.after_request
def _cors(r):
    # Allow requests from Vercel domain (update with your actual domain)
    allowed_origins = [
        "http://localhost:5173",
        "https://FailoverCamSecurity.vercel.app",
        "*"  # Update this
    ]
    origin = request.headers.get('Origin')
    if origin in allowed_origins:
        r.headers["Access-Control-Allow-Origin"] = origin
    r.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Range"
    r.headers["Access-Control-Expose-Headers"] = "Content-Range, Accept-Ranges, Content-Length"
    return r

# ========= GLOBALS =========
lock = threading.Lock()
last_frame = None
current_feed = "primary"
current_camera_url = PRIMARY_URL  # Track current camera URL for failover
pipeline = None
stop_flag = False
last_detection_time = 0
logs = []
log_lock = threading.Lock()
seen_log_hashes = set()  # Track unique logs to prevent duplicates
stream_threads_started = False  # Track if inference threads are started
stream_threads_lock = threading.Lock()  # Lock for thread management
shutdown_flag = False  # Flag to signal all threads to stop

# Alerts storage
alerts = []
alerts_lock = threading.Lock()
alert_id_counter = 0
seen_alert_hashes = set()  # Track unique alerts to prevent duplicates

# Make sure last_labels and stable_labels are always defined and accessible
last_labels = []
stable_labels = []
black_frame_count = 0
blackout_threshold = 5  # seconds
frame_check_interval = 1  # seconds
last_blackout_time = None

# --- globals ---
health = {
    "feed_url": None,
    "latency_ms": None,
    "jitter_ms": None,
    "packet_loss_pct": None,
    "fps": 0.0,
    "status": "UNKNOWN",
    "last_updated": None
}

# rolling frame timestamps (for FPS)
_frame_times = deque(maxlen=120)

# Configure annotators - labels will show object names with confidence
label_annotator = sv.LabelAnnotator()
box_annotator = sv.BoxAnnotator()


# =========== BACKUP CAMERAS MANAGEMENT ===============

def load_backup_cameras():
    """Load backup cameras from JSON file"""
    try:
        print(f"DEBUG: Checking if {BACKUP_CAMERAS_FILE} exists...", flush=True)
        if os.path.exists(BACKUP_CAMERAS_FILE):
            print(f"DEBUG: File exists, reading...", flush=True)
            with open(BACKUP_CAMERAS_FILE, 'r') as f:
                data = json.load(f)
                # Ensure we have a list of backup cameras
                if isinstance(data, list):
                    print(f"DEBUG: Loaded {len(data)} cameras from file", flush=True)
                    return data
                elif isinstance(data, dict) and 'backup_cameras' in data:
                    print(f"DEBUG: Loaded {len(data['backup_cameras'])} cameras from dict", flush=True)
                    return data['backup_cameras']
                else:
                    print("DEBUG: File format not recognized, returning empty list", flush=True)
                    return []
        else:
            print(f"DEBUG: File does not exist, initializing...", flush=True)
            # Initialize with legacy backup URL if it exists
            backup_cameras = []
            if BACKUP_URL and BACKUP_URL != PRIMARY_URL:
                # Parse URL manually to avoid dependency on parse_host_port_from_url
                from urllib.parse import urlparse
                u = urlparse(BACKUP_URL)
                host = u.hostname
                port = u.port or 8080
                backup_cameras.append({
                    "id": "backup_1",
                    "name": "Backup Camera 1",
                    "url": BACKUP_URL,
                    "ip": host,
                    "port": str(port),
                    "username": "",
                    "password": ""
                })
                print(f"DEBUG: Saving backup cameras to file...", flush=True)
                save_backup_cameras(backup_cameras)
                print(f"DEBUG: Backup cameras saved", flush=True)
            return backup_cameras
    except Exception as e:
        print(f"DEBUG: Exception in load_backup_cameras: {str(e)}", flush=True)
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}", flush=True)
        add_log("BACKUP_CAMERAS_LOAD_ERROR", f"Error loading backup cameras: {str(e)}")
        return []


def save_backup_cameras(backup_cameras):
    """Save backup cameras to JSON file"""
    try:
        print(f"DEBUG: save_backup_cameras() called with {len(backup_cameras)} cameras", flush=True)
        print(f"DEBUG: Acquiring lock in save_backup_cameras...", flush=True)
        with backup_cameras_lock:
            print(f"DEBUG: Lock acquired in save_backup_cameras, opening file {BACKUP_CAMERAS_FILE}...", flush=True)
            with open(BACKUP_CAMERAS_FILE, 'w') as f:
                print(f"DEBUG: File opened, writing JSON...", flush=True)
                json.dump(backup_cameras, f, indent=2)
                print(f"DEBUG: JSON written successfully", flush=True)
            print(f"DEBUG: File closed, calling add_log...", flush=True)
            add_log("BACKUP_CAMERAS_SAVED", f"Saved {len(backup_cameras)} backup camera(s)")
            print(f"DEBUG: save_backup_cameras() completed", flush=True)
    except Exception as e:
        print(f"DEBUG: Exception in save_backup_cameras: {str(e)}", flush=True)
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}", flush=True)
        add_log("BACKUP_CAMERAS_SAVE_ERROR", f"Error saving backup cameras: {str(e)}")


def get_backup_cameras():
    """Get list of backup cameras (thread-safe)"""
    print("DEBUG: get_backup_cameras() called", flush=True)
    print(f"DEBUG: Acquiring lock...", flush=True)
    with backup_cameras_lock:
        print("DEBUG: Lock acquired, calling load_backup_cameras()", flush=True)
        result = load_backup_cameras()
        print(f"DEBUG: load_backup_cameras() returned {len(result)} cameras", flush=True)
        return result.copy()


def build_camera_url(ip, port, username=None, password=None):
    """Build camera URL with optional authentication"""
    from urllib.parse import quote_plus
    if username and password:
        # URL encode username and password to handle special characters
        encoded_username = quote_plus(username)
        encoded_password = quote_plus(password)
        return f"http://{encoded_username}:{encoded_password}@{ip}:{port}/video"
    else:
        return f"http://{ip}:{port}/video"


def get_next_available_camera(current_url):
    """Get the next available camera in the failover chain: primary -> backup1 -> backup2 -> ... -> primary"""
    backup_cameras = get_backup_cameras()
    
    # If we're on primary, try first backup
    if current_url == PRIMARY_URL:
        if backup_cameras:
            next_camera = backup_cameras[0]
            return build_camera_url(next_camera['ip'], next_camera['port'], 
                                   next_camera.get('username'), next_camera.get('password')), "backup", next_camera.get('name', 'Backup Camera')
        else:
            # No backups, return primary (will loop)
            return PRIMARY_URL, "primary", "Primary Camera"
    
    # If we're on a backup, find current index and try next
    current_backup_url = None
    current_index = -1
    
    for i, backup in enumerate(backup_cameras):
        backup_url = build_camera_url(backup['ip'], backup['port'], 
                                     backup.get('username'), backup.get('password'))
        if backup_url == current_url:
            current_index = i
            current_backup_url = backup_url
            break
    
    # If we found the current backup, try next one
    if current_index >= 0:
        if current_index + 1 < len(backup_cameras):
            # Try next backup
            next_camera = backup_cameras[current_index + 1]
            return build_camera_url(next_camera['ip'], next_camera['port'],
                                   next_camera.get('username'), next_camera.get('password')), "backup", next_camera.get('name', 'Backup Camera')
        else:
            # Tried all backups, go back to primary
            return PRIMARY_URL, "primary", "Primary Camera"
    
    # If current URL doesn't match any known camera, try first backup or primary
    if backup_cameras:
        next_camera = backup_cameras[0]
        return build_camera_url(next_camera['ip'], next_camera['port'],
                               next_camera.get('username'), next_camera.get('password')), "backup", next_camera.get('name', 'Backup Camera')
    else:
        return PRIMARY_URL, "primary", "Primary Camera"


def get_all_camera_urls():
    """Get all camera URLs including primary and backups"""
    cameras = [{"url": PRIMARY_URL, "label": "primary", "name": "Primary Camera"}]
    backup_cameras = get_backup_cameras()
    for backup in backup_cameras:
        backup_url = build_camera_url(backup['ip'], backup['port'],
                                     backup.get('username'), backup.get('password'))
        cameras.append({
            "url": backup_url,
            "label": "backup",
            "name": backup.get('name', 'Backup Camera'),
            "id": backup.get('id')
        })
    return cameras


# =========== HELPER ===============

def parse_host_port_from_url(url):
    """Return (host, port) from url. Default port 80 or 443 for http/https, or 8080 for common IP cam apps."""
    u = urlparse(url)
    host = u.hostname
    port = u.port
    scheme = u.scheme.lower()
    if port is None:
        if scheme == "https":
            port = 443
        elif scheme == "http":
            port = 80
    return host, port or 80


def tcp_probe_attempts(url, attempts=2, timeout=2.0, try_alt_port_8080=True):
    """
    Try TCP connection attempts to the host:port in `url`.
    Returns tuple (success: bool, details: list_of_attempts)
    """
    host, port = parse_host_port_from_url(url)
    results = []

    if not host:
        return False, [{"attempt": 0, "host": host, "port": port, "ok": False, "error": "invalid URL"}]

    for i in range(1, attempts + 1):
        attempt_port = port
        if i == 2 and try_alt_port_8080 and (port == 80):
            attempt_port = 8080

        attempt = {"attempt": i, "host": host, "port": attempt_port, "ok": False, "error": None}
        try:
            sock = socket.create_connection((host, attempt_port), timeout=timeout)
            sock.close()
            attempt["ok"] = True
            results.append(attempt)
            return True, results
        except Exception as e:
            attempt["ok"] = False
            attempt["error"] = str(e)
            results.append(attempt)
            time.sleep(0.3)
            continue

    return False, results


# ========= LOGGING FUNCTION =========
def add_log(tag, message):
    """Thread-safe logging with duplicate prevention"""
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # Create unique hash for this log (tag + message combination)
    log_hash = f"{tag}:{message}"
    
    with log_lock:
        # Skip if this exact log was already added
        if log_hash in seen_log_hashes:
            return
        
        seen_log_hashes.add(log_hash)
        
        log_entry = {
            "timestamp": timestamp,
            "tag": tag,
            "message": message
        }
        logs.append(log_entry)
        print(f"{timestamp} — {tag}: {message}", flush=True)


# ========= ALERT FUNCTION =========
def add_alert(type, title, description, detected_objects=None, camera=None, confidence=None):
    """Thread-safe alert creation with duplicate prevention"""
    global alert_id_counter
    
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    timestamp_display = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    
    # Create unique hash for this alert (type + title + detected objects)
    alert_hash = f"{type}:{title}:{','.join(detected_objects) if detected_objects else ''}"
    
    with alerts_lock:
        # Skip if this exact alert was already added in the last 5 seconds
        if alert_hash in seen_alert_hashes:
            return
        
        seen_alert_hashes.add(alert_hash)
        
        alert_id_counter += 1
        alert_entry = {
            "id": alert_id_counter,
            "type": type,  # 'critical', 'warning', 'info'
            "icon": "X" if type == "critical" else "!" if type == "warning" else "✓",
            "title": title,
            "description": description,
            "timestamp": timestamp_display,
            "timestamp_iso": timestamp,
            "camera": camera or (current_feed.upper() + " Camera"),
            "status": "active",
            "acknowledged": False,
            "detected_objects": detected_objects or [],
            "confidence": confidence
        }
        alerts.append(alert_entry)
        
        # Keep only last 100 alerts
        if len(alerts) > 100:
            alerts.pop(0)
        
        print(f"{timestamp} — ALERT [{type.upper()}]: {title} - {description}")
        
        # Remove from seen_alert_hashes after 5 seconds to allow similar alerts later
        def clear_hash():
            time.sleep(5)
            with alerts_lock:
                seen_alert_hashes.discard(alert_hash)
        
        threading.Thread(target=clear_hash, daemon=True).start()


# ========= CALLBACK =========

def on_prediction(predictions: dict, video_frame: VideoFrame):
    global last_frame, last_detection_time, last_labels, stable_labels
    global black_frame_count, blackout_threshold, last_blackout_time
    global threat_detections, recording_active

    # --- FPS calculation (rolling window) ---
    now = time.time()
    _frame_times.append(now)
    if len(_frame_times) >= 2:
        duration = _frame_times[-1] - _frame_times[0]
        if duration > 0:
            health["fps"] = round((len(_frame_times)-1) / duration, 2)

    # === BLACKOUT DETECTION ===
    frame = video_frame.image
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    brightness = gray.mean()

    if brightness < 10:
        black_frame_count += 1
        if last_blackout_time is None:
            last_blackout_time = time.time()
        if time.time() - last_blackout_time > blackout_threshold:
            add_log("BLACKOUT_DETECTED", "⚠️ Screen blackout detected for 5s — triggering failover...")
            handle_blackout_failover()
    else:
        black_frame_count = 0
        last_blackout_time = None

    # Filter out low-confidence predictions
    min_conf = 0.55
    detections = sv.Detections.from_inference(predictions)
    
    # Create mask for high-confidence detections
    confidence_mask = detections.confidence > min_conf
    detections = detections[confidence_mask]
    
    # Get predictions list and filter by confidence
    predictions_list = predictions.get("predictions", [])
    high_conf_predictions = [p for p in predictions_list if p.get("confidence", 0) > min_conf]
    
    # Create labels that match the filtered detections
    # The order should match since both are filtered by the same confidence threshold
    labels = []
    class_names = []
    
    for i, pred in enumerate(high_conf_predictions):
        class_name = pred.get("class", "unknown")
        confidence = pred.get("confidence", 0)
        # Format label as "ClassName Confidence%"
        label_text = f"{class_name} {int(confidence * 100)}%"
        labels.append(label_text)
        class_names.append(class_name)
    
    # If there's still a mismatch, create labels from detections confidence array
    # This ensures labels always match detections
    if len(labels) != len(detections):
        labels = []
        class_names = []
        # Use predictions to get class names, but ensure we match detections count
        pred_index = 0
        for i in range(len(detections)):
            # Get confidence from detections
            conf = float(detections.confidence[i])
            
            # Try to get class name from predictions
            if pred_index < len(high_conf_predictions):
                class_name = high_conf_predictions[pred_index].get("class", "object")
                pred_index += 1
            elif pred_index < len(predictions_list):
                # Fallback to any prediction if available
                class_name = predictions_list[pred_index].get("class", "object")
                pred_index += 1
            else:
                class_name = "object"
            
            label_text = f"{class_name} {int(conf * 100)}%"
            labels.append(label_text)
            class_names.append(class_name)

    # === THREAT DETECTION & AUTO-RECORDING ===
    if is_threat_detected(class_names):
        # Get detected threat objects (only actual threats, explicitly exclude person)
        labels_lower = [label.lower() for label in class_names]
        threat_objects = []
        for label in class_names:
            label_lower = label.lower()
            
            # Explicitly skip non-threat objects like person
            is_non_threat = any(non_threat in label_lower for non_threat in NON_THREAT_OBJECTS)
            if is_non_threat:
                continue
            
            # Check if this label matches any threat object
            for threat in THREAT_OBJECTS:
                if threat in label_lower:
                    threat_objects.append(label)
                    break
        
        # Only count if we have actual threat objects (not person)
        if threat_objects:
            now = time.time()
            new_threat_detected = False
            
            # Check each threat object and only count if it's a new detection (cooldown expired)
            for threat_obj in threat_objects:
                threat_key = threat_obj.lower()
                last_detection_time = threat_detection_cooldown.get(threat_key, 0)
                
                # Only count if this threat type hasn't been detected recently
                if now - last_detection_time >= THREAT_COOLDOWN_SECONDS:
                    threat_detections.append(now)
                    threat_detection_cooldown[threat_key] = now
                    new_threat_detected = True
                    add_log("THREAT_COUNTED", f"Threat '{threat_obj}' counted (Total in window: {len([t for t in threat_detections if now - t <= THREAT_DETECTION_WINDOW])})")
            
            # Only create alert and check threshold if this is a new detection
            if new_threat_detected:
                # Get average confidence for threats
                threat_confidences = [p.get("confidence", 0) for p in predictions.get("predictions", []) 
                                     if p.get("confidence", 0) > min_conf and any(threat in p.get("class", "").lower() for threat in THREAT_OBJECTS)]
                avg_confidence = sum(threat_confidences) / len(threat_confidences) if threat_confidences else 0
                
                # Create critical alert for threat detection
                add_alert(
                    type="critical",
                    title="Threat Detected - Security Alert",
                    description=f"Potentially dangerous objects detected: {', '.join(threat_objects)}",
                    detected_objects=threat_objects,
                    camera=current_feed.upper() + " Camera",
                    confidence=round(avg_confidence * 100, 1)
                )
                
                # Check if threshold is met and not already recording
                if not recording_active and check_threat_threshold():
                    add_log("RECORDING_TRIGGER", f"Recording triggered: {len([t for t in threat_detections if now - t <= THREAT_DETECTION_WINDOW])} threat detections in last {THREAT_DETECTION_WINDOW}s")
                    start_recording()
                    # Clear detections after starting recording to prevent immediate re-trigger
                    threat_detections.clear()
                    threat_detection_cooldown.clear()

    # Stabilize detections
    if class_names == last_labels:
        stable_labels = class_names
    last_labels = class_names

    # Annotate frame with bounding boxes and labels
    annotated = box_annotator.annotate(scene=frame.copy(), detections=detections)
    
    # Annotate with labels (object name + confidence) - only if we have matching labels
    if len(labels) == len(detections) and len(detections) > 0:
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=labels)
    elif len(detections) > 0:
        # If labels don't match, create basic labels from detections
        fallback_labels = [f"Object {int(conf * 100)}%" for conf in detections.confidence]
        annotated = label_annotator.annotate(scene=annotated, detections=detections, labels=fallback_labels)

    cv2.putText(annotated, f"ACTIVE FEED: {current_feed.upper()}",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

    with lock:
        last_frame = annotated

    # Log detection only every 3 seconds
    if class_names and (time.time() - last_detection_time > 3):
        add_log("DETECTION", f"Detected objects: {', '.join(class_names)}")
        last_detection_time = time.time()



# ========= STREAM TEST =========
def is_stream_alive(url, timeout=3):
    """Check if stream gives a valid frame within timeout."""
    try:
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            cap.release()
            return False

        start = time.time()
        success = False
        while time.time() - start < timeout:
            ret, _ = cap.read()
            if ret:
                success = True
                break
        cap.release()
        return success
    except Exception as e:
        add_log("STREAM_TEST_ERROR", f"Error testing stream {url}: {str(e)}")
        return False


#==== function for network health ========

def _host_port_from_url(url):
    u = urlparse(url)
    host = u.hostname
    port = u.port or (443 if u.scheme == "https" else 80)
    return host, port

def sample_tcp_metrics(url, attempts=6, timeout=1.5):
    host, port = _host_port_from_url(url)
    rtts = []
    failures = 0

    for _ in range(attempts):
        start = time.perf_counter()
        try:
            s = socket.create_connection((host, port), timeout=timeout)
            s.close()
            rtt = (time.perf_counter() - start) * 1000.0
            rtts.append(rtt)
        except Exception:
            failures += 1
        time.sleep(0.1)

    packet_loss = (failures / attempts) * 100.0
    latency = round(statistics.mean(rtts), 1) if rtts else None
    jitter = round(statistics.pstdev(rtts), 1) if len(rtts) > 1 else (0.0 if rtts else None)
    return latency, jitter, packet_loss


def grade_status(latency, jitter, loss):
    # simple heuristic; tweak for your network
    if latency is None:
        return "DOWN"
    if latency < 80 and jitter < 20 and loss < 2:
        return "GOOD"
    if latency < 200 and jitter < 50 and loss < 8:
        return "FAIR"
    return "POOR"


def health_sampler(poll_sec=5):
    global health, current_feed, current_camera_url, shutdown_flag
    while not shutdown_flag:
        try:
            url = current_camera_url  # Use current camera URL from global
            health["feed_url"] = url
            lat, jit, loss = sample_tcp_metrics(url)
            health["latency_ms"] = lat
            health["jitter_ms"] = jit
            health["packet_loss_pct"] = round(loss, 1) if loss is not None else None
            health["status"] = grade_status(lat, jit, loss)
            health["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        except Exception:
            health["status"] = "UNKNOWN"
        time.sleep(poll_sec)


#======= video recording ============


# ========= RECORDING CONFIG =========
RECORDINGS_DIR = "recordings"
RECORDING_DURATION = 60  # 1 minute in seconds
THREAT_DETECTION_WINDOW = 10  # seconds
THREAT_DETECTION_THRESHOLD = 2  # detections needed to trigger recording (3 detections within 10 seconds)

# Malicious objects to monitor (person is NOT a threat)
THREAT_OBJECTS = [
    "knife", "gun", "pistol", "rifle", "weapon", 
    "blade", "sword", "machete", "axe", "hammer",
    "crowbar", "bat", "stick", "rod"
]

# Objects to explicitly exclude from threat detection
NON_THREAT_OBJECTS = ["person", "people", "human"]

# Create recordings directory if it doesn't exist
os.makedirs(RECORDINGS_DIR, exist_ok=True)

# ========= RECORDING GLOBALS =========
recording_active = False
recording_thread = None
video_writer = None
recording_start_time = None
threat_detections = deque(maxlen=100)  # Store timestamps of threat detections
threat_detection_cooldown = {}  # Track last detection time per threat type to avoid counting same threat multiple times
recording_lock = threading.Lock()
THREAT_COOLDOWN_SECONDS = 3  # Minimum seconds between counting the same threat type again


# ========= THREAT DETECTION CHECKER =========
def is_threat_detected(labels):
    """Check if any detected labels match threat objects"""
    if not labels:
        return False
    
    labels_lower = [label.lower() for label in labels]
    for threat in THREAT_OBJECTS:
        if any(threat in label for label in labels_lower):
            return True
    return False


def check_threat_threshold():
    """Check if threat detections exceed threshold in time window"""
    now = time.time()
    
    # Remove old detections outside the time window
    while threat_detections and (now - threat_detections[0]) > THREAT_DETECTION_WINDOW:
        threat_detections.popleft()
    
    # Check if we have enough detections
    return len(threat_detections) >= THREAT_DETECTION_THRESHOLD


# ========= RECORDING FUNCTIONS =========
def start_recording():
    """Start video recording in a separate thread"""
    global recording_active, recording_thread
    
    with recording_lock:
        if recording_active:
            return  # Already recording
        
        recording_active = True
        add_log("RECORDING_START", f"⚠️ Threat detected! Starting 60-second recording...")
        
        recording_thread = threading.Thread(target=record_video, daemon=True)
        recording_thread.start()


def record_video():
    """Record video for specified duration"""
    global video_writer, recording_start_time, recording_active, last_frame
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"threat_recording_{timestamp}.mp4"
    filepath = os.path.join(RECORDINGS_DIR, filename)
    
    # Initialize video writer with MP4 codec (H.264) for browser compatibility
    # Try 'avc1' (H.264) first, fallback to 'mp4v' if not available
    fourcc = cv2.VideoWriter_fourcc(*'avc1')  # H.264 codec for better browser support
    fps = 20.0
    frame_size = None
    video_writer = None
    recording_start_time = time.time()
    
    add_log("RECORDING_FILE", f"Recording to: {filename}")
    
    try:
        while recording_active and (time.time() - recording_start_time) < RECORDING_DURATION:
            if last_frame is not None:
                with lock:
                    frame = last_frame.copy()
                
                # Initialize writer on first frame
                if video_writer is None:
                    frame_size = (frame.shape[1], frame.shape[0])
                    video_writer = cv2.VideoWriter(filepath, fourcc, fps, frame_size)
                    
                    if not video_writer.isOpened():
                        # Fallback to mp4v if avc1 doesn't work
                        add_log("RECORDING_WARNING", "avc1 codec failed, trying mp4v")
                        fourcc_fallback = cv2.VideoWriter_fourcc(*'mp4v')
                        video_writer = cv2.VideoWriter(filepath, fourcc_fallback, fps, frame_size)
                        
                        if not video_writer.isOpened():
                            add_log("RECORDING_ERROR", "Failed to initialize video writer with both codecs")
                            break
                
                # Add recording indicator to frame
                elapsed = int(time.time() - recording_start_time)
                remaining = RECORDING_DURATION - elapsed
                cv2.putText(frame, f"REC {remaining}s", 
                           (frame.shape[1] - 150, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                cv2.circle(frame, (frame.shape[1] - 180, 25), 8, (0, 0, 255), -1)
                
                # Write frame
                video_writer.write(frame)
            
            time.sleep(0.05)  # ~20 FPS
        
        # Recording completed
        duration = time.time() - recording_start_time
        add_log("RECORDING_COMPLETE", f"Recording saved: {filename} ({int(duration)}s)")
        
    except Exception as e:
        add_log("RECORDING_ERROR", f"Error during recording: {str(e)}")
    
    finally:
        # Cleanup
        if video_writer is not None:
            video_writer.release()
        recording_active = False
        video_writer = None


def stop_recording():
    """Stop ongoing recording"""
    global recording_active
    
    with recording_lock:
        if recording_active:
            recording_active = False
            add_log("RECORDING_STOP", "Recording stopped manually")








#==== handle blackout =======
def handle_blackout_failover():
    """Triggered when camera feed is black for too long. Switches to next available camera."""
    global stop_flag, current_feed, pipeline, current_camera_url

    add_log("BLACKOUT_TRIGGER", f"Stopping {current_feed} feed due to blackout.")
    stop_flag = True
    time.sleep(1)
    cleanup_pipeline()

    # Get next available camera using current URL from global
    new_url, new_label, new_name = get_next_available_camera(current_camera_url)
    current_camera_url = new_url
    add_log("BLACKOUT_SWITCH", f"Switching to {new_label.upper()} feed ({new_name}: {new_url}) due to blackout.")

    stop_flag = False
    threading.Thread(target=run_inference, args=(new_url, new_label), daemon=True).start()



# ========= FAILOVER WATCHER =========
def failover_watcher():
    """Enhanced failover watcher with detailed TCP probe logging. Supports dynamic backup cameras."""
    global stop_flag, current_feed, pipeline, current_camera_url, shutdown_flag

    last_tcp_ok = None
    last_frame_ok = None
    last_feed_url = None
    last_status = None
    last_check_log_time = 0

    add_log("FAILOVER_WATCHER_START", "Failover watcher thread started")

    while not shutdown_flag:
        # Get current URL from global (updated by run_inference)
        current_url = current_camera_url
        
        now = time.time()
        if current_url != last_feed_url or now - last_check_log_time > 60:
            add_log("CHECKING_STREAM", f"Testing connection for {current_url}")
            last_check_log_time = now

        # Step 1: TCP-level probe
        tcp_ok, tcp_details = tcp_probe_attempts(current_url)

        if tcp_ok != last_tcp_ok or current_url != last_feed_url:
            if tcp_ok:
                add_log("TCP_PROBE_OK", f"TCP reachable for {current_url}")
            else:
                # Log each attempt individually
                for attempt in tcp_details:
                    if attempt['ok']:
                        result = "succeeded"
                    else:
                        result = f"failed: {attempt['error']}"
                    add_log("TCP_PROBE_ATTEMPT",
                            f"Attempt #{attempt['attempt']} to {attempt['host']}:{attempt['port']} {result}")

                add_log("TCP_PROBE_FAIL", f"All TCP attempts failed for {current_url}")
            last_tcp_ok = tcp_ok

        # Step 2: Frame check (only if TCP OK)
        frame_ok = is_stream_alive(current_url) if tcp_ok else False
        if frame_ok != last_frame_ok or current_url != last_feed_url:
            if frame_ok:
                add_log("FRAME_CHECK_OK", f"Frame stream verified for {current_url}")
            elif tcp_ok:
                add_log("FRAME_CHECK_FAIL", f"TCP OK but no valid frames for {current_url}")
            last_frame_ok = frame_ok

        # === Case A: Feed healthy ===
        if tcp_ok and frame_ok:
            if last_status != "alive" or current_url != last_feed_url:
                add_log("STREAM_OK", f"Stream {current_url} is active and healthy")
                last_status = "alive"

        # === Case B: Failure detected ===
        elif not tcp_ok or not frame_ok:
            if last_status != "failed" or current_url != last_feed_url:
                add_log("STREAM_FAILED", f"Stream {current_url} failed (TCP: {tcp_ok}, Frames: {frame_ok})")
                add_log("FEED_FAILED", f"{current_url} unreachable, initiating failover")
                last_status = "failed"

                stop_flag = True
                time.sleep(1)
                cleanup_pipeline()

                # Get next available camera using dynamic backup cameras
                new_url, new_label, new_name = get_next_available_camera(current_url)
                current_camera_url = new_url
                add_log("SWITCH_FEED", f"Switching to {new_label.upper()} feed ({new_name}: {new_url})")

                stop_flag = False
                threading.Thread(target=run_inference, args=(new_url, new_label), daemon=True).start()

                # Reset state trackers
                last_tcp_ok = None
                last_frame_ok = None
                last_feed_url = new_url
                last_status = "recovering"
                last_check_log_time = 0

        last_feed_url = current_url
        time.sleep(5)


# ========= CLEANUP FUNCTION =========
def cleanup_pipeline():
    global pipeline
    add_log("CLEANUP_START", "Cleaning up old pipeline")
    try:
        if pipeline:
            if hasattr(pipeline, "terminate"):
                pipeline.terminate()
            elif hasattr(pipeline, "close"):
                pipeline.close()
            elif hasattr(pipeline, "stop"):
                pipeline.stop()
        pipeline = None
        add_log("CLEANUP_DONE", "Cleanup complete")
    except Exception as e:
        add_log("CLEANUP_ERROR", f"Error during cleanup: {str(e)}")
    gc.collect()
    time.sleep(1)


# ========= STREAM CHECK =========
def is_stream_reachable(url, timeout=5.0):
    """Check if video stream URL is accessible"""
    try:
        add_log("STREAM_CHECK", f"Checking stream accessibility: {url}")
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            cap.release()
            add_log("STREAM_CHECK_FAIL", f"Failed to open stream: {url}")
            return False
        start = time.time()
        while time.time() - start < timeout:
            ret, _ = cap.read()
            if ret:
                cap.release()
                add_log("STREAM_CHECK_OK", f"Stream is accessible: {url}")
                return True
            time.sleep(0.2)
        cap.release()
        add_log("STREAM_CHECK_TIMEOUT", f"Stream check timeout: {url}")
        return False
    except Exception as e:
        add_log("STREAM_CHECK_ERROR", f"Error checking stream: {str(e)}")
        return False

# ========= PIPELINE RUNNER =========
def run_inference(url, label):
    global pipeline, current_feed, stop_flag, current_camera_url
    current_feed = label
    current_camera_url = url  # Update global current URL
    
    add_log("PIPELINE_START", f"Starting {label} feed: {url}")
    
    # Check if stream is reachable before initializing pipeline
    if not is_stream_reachable(url, timeout=5.0):
        add_log("PIPELINE_SKIP", f"Skipping {label} feed - stream not reachable: {url}")
        return
    
    local_pipeline = None
    try:
        add_log("PIPELINE_INIT_START", f"Initializing {label} pipeline...")
        local_pipeline = InferencePipeline.init(
            api_key=ROBOFLOW_API_KEY,
            model_id=MODEL_ID,
            video_reference=url,
            on_prediction=on_prediction
        )
        pipeline = local_pipeline  # Update global pipeline
        add_log("PIPELINE_INIT_OK", f"{label} pipeline initialized successfully")
        
        #add_log("PIPELINE_START_CALL", f"Starting {label} pipeline...")
        local_pipeline.start()
        add_log("PIPELINE_RUNNING", f"{label} pipeline is now running")
         
        while not stop_flag:
            time.sleep(1)
            
    except Exception as e:
        add_log("PIPELINE_ERROR", f"{label} feed error: {str(e)}")
        import traceback
        add_log("PIPELINE_ERROR_TRACE", f"Traceback: {traceback.format_exc()}")
    finally:
        if local_pipeline:
            try:
                if hasattr(local_pipeline, 'terminate'):
                    local_pipeline.terminate()
                elif hasattr(local_pipeline, 'close'):
                    local_pipeline.close()
                add_log("PIPELINE_STOPPED", f"{label} pipeline stopped")
            except Exception as e:
                add_log("PIPELINE_STOP_ERROR", f"Error stopping {label} pipeline: {str(e)}")


# ========= MJPEG STREAM =========
def generate_frames():
    global last_frame
    while True:
        if last_frame is not None:
            with lock:
                _, buffer = cv2.imencode('.jpg', last_frame)
                frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        time.sleep(0.05)


@app.route('/ai_feed')
def ai_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/status')
def status():
    return jsonify({"active_feed": current_feed})


# ========= LOGS ENDPOINT =========
@app.route("/logs/since/<last_time>")
def get_logs_since(last_time):
    try:
        last_time = float(last_time)
    except ValueError:
        last_time = 0.0

    new_logs = []
    with log_lock:
        for log in logs:
            try:
                ts = datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00")).timestamp()
                if ts > last_time:
                    new_logs.append(log)
            except Exception as e:
                print(f"Timestamp parse failed: {e}")

    # Sort by timestamp to maintain order
    new_logs.sort(key=lambda l: l["timestamp"])
    return jsonify(new_logs)


# ========= ALERTS ENDPOINT =========
@app.route("/alerts")
def get_alerts():
    """Get all alerts"""
    with alerts_lock:
        # Return alerts in reverse order (newest first)
        return jsonify(list(reversed(alerts)))


@app.route("/alerts/acknowledge/<int:alert_id>", methods=["POST"])
def acknowledge_alert(alert_id):
    """Acknowledge an alert"""
    with alerts_lock:
        for alert in alerts:
            if alert["id"] == alert_id:
                alert["acknowledged"] = True
                alert["status"] = "resolved"
                return jsonify({"success": True, "alert": alert})
    return jsonify({"success": False, "error": "Alert not found"}), 404


# =====  camera Auth ==========
@app.route("/camera/auth" ,  methods=["POST"])
def check_camera_stream():
    """Check camera authentication without starting inference threads"""
    data = request.json
    ip = data.get("ip")
    port = data.get("port", "8080")
    username = data.get("username")
    password = data.get("password")

    if not ip:
        return jsonify({"success": False, "error": "IP address is required"}), 400

    test_url = f"http://{ip}:{port}/video"

    # Inject username/password if given
    if username and password:
        from urllib.parse import quote_plus
        encoded_username = quote_plus(username)
        encoded_password = quote_plus(password)
        test_url = f"http://{encoded_username}:{encoded_password}@{ip}:{port}/video"

    # Quick stream check without starting inference pipeline
    try:
        cap = cv2.VideoCapture(test_url)
        if not cap.isOpened():
            cap.release()
            #add_log("AUTH_FAIL", f"Camera authentication test failed: {ip}:{port} - Cannot open stream")
            return jsonify({"success": False, "error": "Cannot open camera stream"})
        
        start_time = time.time()
        authenticated = False
        
        while time.time() - start_time < 5:
            ret, frame = cap.read()
            if ret:
                authenticated = True
                break
            time.sleep(0.5)
        cap.release()
        
        if authenticated:
            #add_log("AUTH_SUCCESS", f"Camera authentication test passed: {ip}:{port}")
            return jsonify({"success": True})
        else:
            #add_log("AUTH_FAIL", f"Camera authentication test failed: {ip}:{port} - No frames received")
            return jsonify({"success": False, "error": "No frames received from camera"})
    except Exception as e:
        #add_log("AUTH_ERROR", f"Camera authentication test error: {ip}:{port} - {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/camera/config", methods=["GET"])
def get_camera_config():
    """Get camera configuration (IP and port for primary and backup cameras)"""
    try:
        primary_host, primary_port = parse_host_port_from_url(PRIMARY_URL)
        backup_cameras = get_backup_cameras()
        
        # Build response with primary and all backup cameras
        response = {
            "success": True,
            "primary": {
                "ip": primary_host,
                "port": str(primary_port),
                "url": PRIMARY_URL
            },
            "backup_cameras": backup_cameras
        }
        
        # For backward compatibility, include first backup as "backup"
        if backup_cameras:
            first_backup = backup_cameras[0]
            response["backup"] = {
                "ip": first_backup.get("ip"),
                "port": first_backup.get("port"),
                "url": build_camera_url(first_backup.get("ip"), first_backup.get("port"),
                                       first_backup.get("username"), first_backup.get("password"))
            }
        else:
            # Legacy backup URL if no backup cameras configured
            backup_host, backup_port = parse_host_port_from_url(BACKUP_URL)
            response["backup"] = {
                "ip": backup_host,
                "port": str(backup_port),
                "url": BACKUP_URL
            }
        
        return jsonify(response)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/backup-cameras", methods=["GET"])
def get_backup_cameras_endpoint():
    """Get all backup cameras"""
    try:
        backup_cameras = get_backup_cameras()
        return jsonify({
            "success": True,
            "backup_cameras": backup_cameras,
            "count": len(backup_cameras)
        })
    except Exception as e:
        add_log("BACKUP_CAMERAS_GET_ERROR", f"Error getting backup cameras: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/backup-cameras", methods=["POST"])
def add_backup_camera():
    """Add a new backup camera"""
    try:
        data = request.json
        ip = data.get("ip")
        port = data.get("port", "8080")
        username = data.get("username", "")
        password = data.get("password", "")
        name = data.get("name", f"Backup Camera {len(get_backup_cameras()) + 1}")
        
        if not ip:
            return jsonify({"success": False, "error": "IP address is required"}), 400
        
        # Validate IP and port
        try:
            port_int = int(port)
            if port_int < 1 or port_int > 65535:
                return jsonify({"success": False, "error": "Port must be between 1 and 65535"}), 400
        except ValueError:
            return jsonify({"success": False, "error": "Invalid port number"}), 400
        
        # Test camera connection
        test_url = build_camera_url(ip, port, username if username else None, password if password else None)
        if not is_stream_alive(test_url, timeout=5):
            return jsonify({
                "success": False,
                "error": "Camera stream test failed. Please check IP, port, and credentials."
            }), 400
        
        # Generate unique ID
        backup_cameras = get_backup_cameras()
        camera_id = f"backup_{len(backup_cameras) + 1}_{int(time.time())}"
        
        # Create camera object
        new_camera = {
            "id": camera_id,
            "name": name,
            "ip": ip,
            "port": str(port),
            "username": username,
            "password": password,  # Note: In production, encrypt this
            "url": test_url,
            "added_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }
        
        # Add to list
        backup_cameras.append(new_camera)
        save_backup_cameras(backup_cameras)
        
        add_log("BACKUP_CAMERA_ADDED", f"Added backup camera: {name} ({ip}:{port})")
        return jsonify({
            "success": True,
            "message": "Backup camera added successfully",
            "camera": new_camera
        })
    except Exception as e:
        add_log("BACKUP_CAMERA_ADD_ERROR", f"Error adding backup camera: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/backup-cameras/<camera_id>", methods=["DELETE"])
def delete_backup_camera(camera_id):
    """Delete a backup camera"""
    try:
        backup_cameras = get_backup_cameras()
        original_count = len(backup_cameras)
        
        # Remove camera with matching ID
        backup_cameras = [cam for cam in backup_cameras if cam.get("id") != camera_id]
        
        if len(backup_cameras) == original_count:
            return jsonify({"success": False, "error": "Camera not found"}), 404
        
        save_backup_cameras(backup_cameras)
        add_log("BACKUP_CAMERA_DELETED", f"Deleted backup camera: {camera_id}")
        return jsonify({
            "success": True,
            "message": "Backup camera deleted successfully",
            "remaining_count": len(backup_cameras)
        })
    except Exception as e:
        add_log("BACKUP_CAMERA_DELETE_ERROR", f"Error deleting backup camera: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/backup-cameras/test", methods=["POST"])
def test_backup_camera():
    """Test backup camera connection and authentication"""
    try:
        data = request.json
        ip = data.get("ip")
        port = data.get("port", "8080")
        username = data.get("username", "")
        password = data.get("password", "")
        
        if not ip:
            return jsonify({"success": False, "error": "IP address is required"}), 400
        
        # Build test URL
        test_url = build_camera_url(ip, port, username if username else None, password if password else None)
        
        # Test connection
        authenticated = is_stream_alive(test_url, timeout=5)
        
        if authenticated:
            add_log("BACKUP_CAMERA_TEST_SUCCESS", f"Camera test passed: {ip}:{port}")
            return jsonify({
                "success": True,
                "message": "Camera connection test successful",
                "url": test_url
            })
        else:
            return jsonify({
                "success": False,
                "error": "Camera connection test failed. Check IP, port, and credentials.",
                "url": test_url
            }), 400
    except Exception as e:
        add_log("BACKUP_CAMERA_TEST_ERROR", f"Error testing backup camera: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

# Camera location storage (in production, use a database or config file)
CAMERA_LOCATIONS = {
    "primary": {
        "lat": None,  # Set manually or via API
        "lng": None,
        "name": "Primary Camera A"
    },
    "backup": {
        "lat": None,
        "lng": None,
        "name": "Backup Camera B"
    }
}

@app.route("/camera/locations", methods=["GET"])
def get_camera_locations():
    """Get camera locations with geolocation data"""
    try:
        primary_host, primary_port = parse_host_port_from_url(PRIMARY_URL)
        backup_host, backup_port = parse_host_port_from_url(BACKUP_URL)
        
        # Check if manual coordinates are set
        primary_lat = CAMERA_LOCATIONS["primary"]["lat"]
        primary_lng = CAMERA_LOCATIONS["primary"]["lng"]
        backup_lat = CAMERA_LOCATIONS["backup"]["lat"]
        backup_lng = CAMERA_LOCATIONS["backup"]["lng"]
        
        # If manual coordinates are set, use them
        if primary_lat is not None and primary_lng is not None:
            primary_location = {
                "lat": primary_lat,
                "lng": primary_lng,
                "city": "Configured Location",
                "country": "Manual"
            }
        else:
            # Try to get geolocation from IP
            primary_location = get_location_from_ip(primary_host)
            # Only save if we got valid coordinates
            if primary_location["lat"] is not None and primary_location["lng"] is not None:
                CAMERA_LOCATIONS["primary"]["lat"] = primary_location["lat"]
                CAMERA_LOCATIONS["primary"]["lng"] = primary_location["lng"]
        
        if backup_lat is not None and backup_lng is not None:
            backup_location = {
                "lat": backup_lat,
                "lng": backup_lng,
                "city": "Configured Location",
                "country": "Manual"
            }
        else:
            backup_location = get_location_from_ip(backup_host)
            # Add slight offset to show both cameras if same location
            if (backup_location["lat"] is not None and primary_location["lat"] is not None and 
                backup_location["lat"] == primary_location["lat"]):
                backup_location["lat"] = primary_location["lat"] + 0.001
                backup_location["lng"] = primary_location["lng"] + 0.001
            # Only save if we got valid coordinates
            if backup_location["lat"] is not None and backup_location["lng"] is not None:
                CAMERA_LOCATIONS["backup"]["lat"] = backup_location["lat"]
                CAMERA_LOCATIONS["backup"]["lng"] = backup_location["lng"]
        
        return jsonify({
            "success": True,
            "cameras": [
                {
                    "id": "primary",
                    "name": CAMERA_LOCATIONS["primary"]["name"],
                    "ip": primary_host,
                    "port": str(primary_port),
                    "type": "primary",
                    "lat": primary_location.get("lat"),
                    "lng": primary_location.get("lng"),
                    "city": primary_location.get("city", "Unknown"),
                    "country": primary_location.get("country", "Unknown")
                },
                {
                    "id": "backup",
                    "name": CAMERA_LOCATIONS["backup"]["name"],
                    "ip": backup_host,
                    "port": str(backup_port),
                    "type": "backup",
                    "lat": backup_location.get("lat"),
                    "lng": backup_location.get("lng"),
                    "city": backup_location.get("city", "Unknown"),
                    "country": backup_location.get("country", "Unknown")
                }
            ]
        })
    except Exception as e:
        add_log("CAMERA_LOCATIONS_ERROR", f"Error getting camera locations: {str(e)}")
        import traceback
        return jsonify({"success": False, "error": str(e), "traceback": traceback.format_exc()}), 500

def get_location_from_ip(ip):
    """Get location from IP address"""
    try:
        # Skip private IPs (192.168.x.x, 10.x.x.x, etc.)
        if ip.startswith(('192.168.', '10.', '172.16.', '127.')):
            # For private IPs, return None to indicate manual configuration needed
            return {
                "lat": None,
                "lng": None,
                "city": "Local Network",
                "country": "Private IP - Configure Manually"
            }
        
        # For public IPs, try geolocation service
        try:
            response = requests.get(f"http://ip-api.com/json/{ip}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    return {
                        "lat": data.get("lat", 0),
                        "lng": data.get("lon", 0),
                        "city": data.get("city", "Unknown"),
                        "country": data.get("country", "Unknown")
                    }
        except Exception as e:
            add_log("GEOLOCATION_API_ERROR", f"IP geolocation API failed: {str(e)}")
        
        # Fallback: return None to indicate manual configuration needed
        return {
            "lat": None,
            "lng": None,
            "city": "Unknown",
            "country": "Location Not Available"
        }
    except Exception as e:
        add_log("GEOLOCATION_ERROR", f"Failed to get location for {ip}: {str(e)}")
        return {
            "lat": None,
            "lng": None,
            "city": "Error",
            "country": "Failed to fetch"
        }

@app.route("/camera/locations", methods=["POST"])
def set_camera_location():
    """Set manual camera location coordinates"""
    try:
        data = request.json
        camera_type = data.get("camera_type")  # "primary" or "backup"
        lat = data.get("lat")
        lng = data.get("lng")
        name = data.get("name")
        
        if camera_type not in ["primary", "backup"]:
            return jsonify({"success": False, "error": "Invalid camera type"}), 400
        
        if lat is None or lng is None:
            return jsonify({"success": False, "error": "Latitude and longitude are required"}), 400
        
        # Validate coordinates
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return jsonify({"success": False, "error": "Invalid coordinates"}), 400
        
        CAMERA_LOCATIONS[camera_type]["lat"] = float(lat)
        CAMERA_LOCATIONS[camera_type]["lng"] = float(lng)
        if name:
            CAMERA_LOCATIONS[camera_type]["name"] = name
        
        add_log("CAMERA_LOCATION_SET", f"{camera_type.upper()} camera location set to ({lat}, {lng})")
        return jsonify({
            "success": True,
            "message": f"{camera_type} camera location updated",
            "location": CAMERA_LOCATIONS[camera_type]
        })
    except Exception as e:
        add_log("CAMERA_LOCATION_SET_ERROR", f"Error setting camera location: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/camera/<camera_type>/settings", methods=["POST"])
def set_camera_setting(camera_type):
    """Set a camera setting (zoom, brightness, exposure, focus, whiteBalance, torch)"""
    try:
        if camera_type not in ["primary", "backup"]:
            return jsonify({"success": False, "error": "Invalid camera type. Use 'primary' or 'backup'"}), 400
        
        data = request.json
        setting = data.get("setting")
        value = data.get("value")
        
        if setting is None or value is None:
            return jsonify({"success": False, "error": "Missing 'setting' or 'value' in request"}), 400
        
        # Get camera URL
        camera_url = PRIMARY_URL if camera_type == "primary" else BACKUP_URL
        camera_host, camera_port = parse_host_port_from_url(camera_url)
        base_url = f"http://{camera_host}:{camera_port}"
        
        # IP Webcam uses different endpoint formats - try multiple patterns
        # Many IP Webcam versions use /settings/{setting}?set={value} format
        # Some use alternative formats or parameter names
        
        # Normalize value for different settings
        # Zoom, brightness, exposure, focus, whiteBalance are typically 0-100
        # But IP Webcam might expect different ranges, so we'll pass as-is
        
        # Map settings to IP webcam endpoints with fallback options
        # Try GET first (most common), then POST if needed
        setting_mappings = {
            "zoom": [
                (f"{base_url}/settings/zoom?set={value}", "GET"),
                (f"{base_url}/zoom?set={value}", "GET"),
                (f"{base_url}/settings/zoom?zoom={value}", "GET"),
                (f"{base_url}/zoom?zoom={value}", "GET"),
                (f"{base_url}/settings/zoom", "POST"),  # POST with data
            ],
            "focus": [
                (f"{base_url}/settings/focus?set={value}", "GET"),
                (f"{base_url}/focus?set={value}", "GET"),
                (f"{base_url}/settings/focus?focus={value}", "GET"),
                (f"{base_url}/focus?focus={value}", "GET"),
            ],
            "exposure": [
                (f"{base_url}/settings/exposure?set={value}", "GET"),
                (f"{base_url}/exposure?set={value}", "GET"),
                (f"{base_url}/settings/exposure?exposure={value}", "GET"),
                (f"{base_url}/exposure?exposure={value}", "GET"),
            ],
            "whiteBalance": [
                (f"{base_url}/settings/whitebalance?set={value}", "GET"),
                (f"{base_url}/settings/wb?set={value}", "GET"),
                (f"{base_url}/whitebalance?set={value}", "GET"),
                (f"{base_url}/wb?set={value}", "GET"),
                (f"{base_url}/settings/whitebalance?whitebalance={value}", "GET"),
            ],
            "brightness": [
                (f"{base_url}/settings/brightness?set={value}", "GET"),
                (f"{base_url}/brightness?set={value}", "GET"),
                (f"{base_url}/settings/brightness?brightness={value}", "GET"),
                (f"{base_url}/brightness?brightness={value}", "GET"),
            ],
            "torch": (
                [
                    (f"{base_url}/enabletorch", "GET"),
                    (f"{base_url}/torch?set=1", "GET"),
                    (f"{base_url}/settings/torch?set=1", "GET"),
                    (f"{base_url}/torch?torch=on", "GET"),
                ] if value else [
                    (f"{base_url}/disabletorch", "GET"),
                    (f"{base_url}/torch?set=0", "GET"),
                    (f"{base_url}/settings/torch?set=0", "GET"),
                    (f"{base_url}/torch?torch=off", "GET"),
                ]
            ),
            "orientation": [
                (f"{base_url}/settings/orientation?set={value}", "GET"),
                (f"{base_url}/orientation?set={value}", "GET"),
            ]
        }
        
        if setting not in setting_mappings:
            return jsonify({"success": False, "error": f"Unknown setting: {setting}"}), 400
        
        endpoint_configs = setting_mappings[setting]
        last_error = None
        errors = []
        
        # Try each endpoint format until one works
        for endpoint_config in endpoint_configs:
            if isinstance(endpoint_config, tuple):
                endpoint_url, method = endpoint_config
            else:
                endpoint_url = endpoint_config
                method = "GET"
            
            try:
                if method == "POST":
                    # Try POST with form data
                    response = requests.post(endpoint_url, data={"set": value}, timeout=3, allow_redirects=True)
                else:
                    response = requests.get(endpoint_url, timeout=3, allow_redirects=True)
                
                status_code = response.status_code
                response_text = response.text[:200] if response.text else ""  # First 200 chars for logging
                add_log("CAMERA_SETTING_ATTEMPT", f"{method} {endpoint_url} -> Status: {status_code}")
                
                # IP Webcam often returns 200 for successful settings changes
                # Some versions return 302 redirects, 204 No Content, or other success codes
                # Check if response is HTML error page (contains common error indicators)
                is_html_error = (
                    status_code == 200 and 
                    response_text and 
                    ("404" in response_text.lower() or 
                     "not found" in response_text.lower() or
                     "<html" in response_text.lower() and "error" in response_text.lower())
                )
                
                if status_code in [200, 204, 302] and not is_html_error:
                    add_log("CAMERA_SETTING", f"{camera_type.upper()} camera: {setting} set to {value} via {method} {endpoint_url}")
                    return jsonify({"success": True, "setting": setting, "value": value, "endpoint": endpoint_url, "method": method})
                elif is_html_error:
                    # Got HTML error page, try next endpoint
                    error_msg = f"HTML error page returned from {endpoint_url}"
                    errors.append(error_msg)
                    last_error = error_msg
                    continue
                elif status_code == 404:
                    # Try next endpoint format
                    error_msg = f"404 Not Found: {endpoint_url}"
                    errors.append(error_msg)
                    last_error = error_msg
                    continue
                elif status_code == 401:
                    # Authentication required
                    error_msg = f"401 Unauthorized: Camera may require authentication for {endpoint_url}"
                    errors.append(error_msg)
                    last_error = error_msg
                    continue
                else:
                    # Other error, log it but try next format
                    error_msg = f"Status {status_code} from {endpoint_url}"
                    errors.append(error_msg)
                    last_error = error_msg
                    continue
                    
            except requests.exceptions.Timeout:
                error_msg = f"Timeout connecting to {endpoint_url}"
                errors.append(error_msg)
                last_error = error_msg
                continue
            except requests.exceptions.ConnectionError as e:
                error_msg = f"Connection error for {endpoint_url}: {str(e)}"
                errors.append(error_msg)
                last_error = error_msg
                continue
            except requests.exceptions.RequestException as e:
                error_msg = f"Request error for {endpoint_url}: {str(e)}"
                errors.append(error_msg)
                last_error = error_msg
                continue
        
        # If all endpoints failed, return error with details
        add_log("CAMERA_SETTING_ERROR", f"All endpoints failed for {setting} on {camera_type}. Errors: {errors}")
        return jsonify({
            "success": False, 
            "error": f"Failed to set {setting}. All {len(endpoint_configs)} endpoint format(s) failed.",
            "last_error": last_error,
            "setting": setting,
            "value": value,
            "camera": camera_type,
            "suggestion": "The IP Webcam app may not support this setting, or it may require authentication. Check the IP Webcam app settings to enable remote control."
        }), 500
            
    except Exception as e:
        add_log("CAMERA_SETTING_ERROR", f"Error setting camera setting: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/camera/<camera_type>/test", methods=["GET"])
def test_camera_endpoints(camera_type):
    """Test which camera endpoints are available"""
    try:
        if camera_type not in ["primary", "backup"]:
            return jsonify({"success": False, "error": "Invalid camera type. Use 'primary' or 'backup'"}), 400
        
        # Get camera URL
        camera_url = PRIMARY_URL if camera_type == "primary" else BACKUP_URL
        camera_host, camera_port = parse_host_port_from_url(camera_url)
        base_url = f"http://{camera_host}:{camera_port}"
        
        # Test common endpoints
        test_endpoints = [
            f"{base_url}/",
            f"{base_url}/video",
            f"{base_url}/settings/zoom?set=50",
            f"{base_url}/zoom?set=50",
            f"{base_url}/settings/brightness?set=50",
            f"{base_url}/brightness?set=50",
            f"{base_url}/battery",
            f"{base_url}/enabletorch",
        ]
        
        results = {}
        for endpoint in test_endpoints:
            try:
                response = requests.get(endpoint, timeout=2, allow_redirects=True)
                results[endpoint] = {
                    "status": response.status_code,
                    "available": response.status_code in [200, 302, 204],
                    "content_type": response.headers.get("Content-Type", "unknown")
                }
            except Exception as e:
                results[endpoint] = {
                    "status": "error",
                    "available": False,
                    "error": str(e)
                }
        
        return jsonify({
            "success": True,
            "camera": camera_type,
            "base_url": base_url,
            "results": results
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/camera/<camera_type>/battery", methods=["GET"])
def get_camera_battery(camera_type):
    """Get battery level of the IP webcam"""
    try:
        if camera_type not in ["primary", "backup"]:
            return jsonify({"success": False, "error": "Invalid camera type. Use 'primary' or 'backup'"}), 400
        
        # Get camera URL
        camera_url = PRIMARY_URL if camera_type == "primary" else BACKUP_URL
        camera_host, camera_port = parse_host_port_from_url(camera_url)
        base_url = f"http://{camera_host}:{camera_port}"
        
        # IP webcam battery endpoint
        battery_url = f"{base_url}/battery"
        
        # Make request to IP webcam
        try:
            response = requests.get(battery_url, timeout=3)
            if response.status_code == 200:
                # IP webcam returns battery level as text (percentage)
                try:
                    battery_level = int(response.text.strip())
                    return jsonify({"success": True, "battery": battery_level})
                except ValueError:
                    return jsonify({"success": False, "error": "Invalid battery response"}), 500
            else:
                return jsonify({"success": False, "error": f"IP webcam returned status {response.status_code}"}), 500
        except requests.exceptions.RequestException as e:
            # Battery endpoint might not be available, return null instead of error
            return jsonify({"success": True, "battery": None})
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/health")
def health_view():
    return jsonify(health), 200

# recording endpoint 


@app.route('/recordings')
def list_recordings():
    """List all recorded videos"""
    try:
        files = []
        for filename in os.listdir(RECORDINGS_DIR):
            if filename.endswith(('.avi', '.mp4')):
                filepath = os.path.join(RECORDINGS_DIR, filename)
                size_mb = os.path.getsize(filepath) / (1024 * 1024)
                files.append({
                    "filename": filename,
                    "size_mb": round(size_mb, 2),
                    "created": datetime.fromtimestamp(
                        os.path.getctime(filepath)
                    ).strftime("%Y-%m-%d %H:%M:%S")
                })
        
        files.sort(key=lambda x: x['created'], reverse=True)
        return jsonify({"recordings": files, "total": len(files)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/recordings/<filename>', methods=['GET', 'OPTIONS'])
def serve_recording(filename):
    """Serve a recording file with Range request support for video streaming"""
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = Response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Range, Content-Type'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
        return response
    
    try:
        # Security: Only allow .mp4 files (AVI support kept for backward compatibility)
        if not filename.endswith(('.avi', '.mp4')):
            return jsonify({"error": "Invalid file type"}), 400
        
        # Check if file exists
        filepath = os.path.join(RECORDINGS_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({"error": "File not found"}), 404
        
        # Get file size
        file_size = os.path.getsize(filepath)
        
        # Determine MIME type
        if filename.endswith('.mp4'):
            mimetype = 'video/mp4'
        elif filename.endswith('.avi'):
            mimetype = 'video/x-msvideo'
        else:
            mimetype = 'application/octet-stream'
        
        # Handle Range requests for video seeking
        range_header = request.headers.get('Range', None)
        if range_header:
            # Parse range header
            byte_start = 0
            byte_end = file_size - 1
            
            range_match = range_header.replace('bytes=', '').split('-')
            if range_match[0]:
                byte_start = int(range_match[0])
            if len(range_match) > 1 and range_match[1]:
                byte_end = int(range_match[1])
            
            # Read the requested byte range
            with open(filepath, 'rb') as f:
                f.seek(byte_start)
                data = f.read(byte_end - byte_start + 1)
            
            # Create response with 206 Partial Content
            response = Response(
                data,
                206,  # Partial Content
                mimetype=mimetype,
                headers={
                    'Content-Range': f'bytes {byte_start}-{byte_end}/{file_size}',
                    'Accept-Ranges': 'bytes',
                    'Content-Length': str(len(data)),
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Range',
                }
            )
            return response
        else:
            # Serve entire file
            return send_from_directory(
                RECORDINGS_DIR, 
                filename, 
                as_attachment=False,
                mimetype=mimetype
            )
    except Exception as e:
        print(f"Error serving recording: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/recording/status')
def recording_status():
    """Get current recording status"""
    if recording_active and recording_start_time:
        elapsed = int(time.time() - recording_start_time)
        remaining = max(0, RECORDING_DURATION - elapsed)
        return jsonify({
            "recording": True,
            "elapsed_seconds": elapsed,
            "remaining_seconds": remaining,
            "total_duration": RECORDING_DURATION
        })
    else:
        return jsonify({
            "recording": False,
            "elapsed_seconds": 0,
            "remaining_seconds": 0,
            "total_duration": RECORDING_DURATION
        })


@app.route('/recording/manual/start', methods=['POST'])
def manual_start_recording():
    """Manually start recording"""
    if recording_active:
        return jsonify({"success": False, "message": "Already recording"}), 400
    
    start_recording()
    return jsonify({"success": True, "message": "Recording started"})


@app.route('/recording/manual/stop', methods=['POST'])
def manual_stop_recording():
    """Manually stop recording"""
    if not recording_active:
        return jsonify({"success": False, "message": "Not currently recording"}), 400
    
    stop_recording()
    return jsonify({"success": True, "message": "Recording stopped"})


# ========= STREAM CONTROL ENDPOINTS =========
@app.route('/stream/start', methods=['POST'])
def start_stream_threads():
    """Start inference threads on demand"""
    global stream_threads_started
    add_log("SYSTEM_START", "AI Failover Server starting")
   
    
    with stream_threads_lock:
        if stream_threads_started:
            return jsonify({
                "success": True,
                "message": "Stream threads already started",
                "already_running": True
            })
        
        try:
            add_log("STREAM_START", "Starting inference threads on demand...")
            
            # Reset flags before starting
            global shutdown_flag, stop_flag
            shutdown_flag = False
            stop_flag = False
            
            # Start primary pipeline
            threading.Thread(target=run_inference, args=(PRIMARY_URL, "primary"), daemon=True).start()
            
            # Start failover watcher
            threading.Thread(target=failover_watcher, daemon=True).start()
            
            # Start health sampler
            threading.Thread(target=health_sampler, daemon=True).start()
            
            stream_threads_started = True
            add_log("STREAM_STARTED", "All inference threads started successfully")
            
            return jsonify({
                "success": True,
                "message": "Stream threads started successfully",
                "already_running": False
            })
        except Exception as e:
            add_log("STREAM_START_ERROR", f"Error starting stream threads: {str(e)}")
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500


@app.route('/stream/status', methods=['GET'])
def get_stream_status():
    """Get status of stream threads"""
    global stream_threads_started
    return jsonify({
        "threads_started": stream_threads_started,
        "active_feed": current_feed,
        "current_url": current_camera_url
    })


@app.route('/stream/stop', methods=['POST'])
def stop_stream_threads():
    """Stop all inference threads"""
    global stream_threads_started, stop_flag, shutdown_flag, pipeline
    
    with stream_threads_lock:
        if not stream_threads_started:
            return jsonify({
                "success": True,
                "message": "Stream threads are not running",
                "already_stopped": True
            })
        
        try:
            add_log("STREAM_STOP", "Stopping all inference threads...")
            
            # Set shutdown flag to stop all threads
            shutdown_flag = True
            stop_flag = True
            
            # Wait a moment for threads to see the flag
            time.sleep(0.5)
            
            # Clean up pipeline
            cleanup_pipeline()
            
            # Wait a bit more for threads to finish
            time.sleep(1)
            
            # Reset flags
            stream_threads_started = False
            shutdown_flag = False
            stop_flag = False
            
            # Reset health metrics
            global health
            health["fps"] = 0.0
            health["status"] = "STOPPED"
            health["last_updated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            
            add_log("STREAM_STOPPED", "All inference threads stopped successfully")
            
            return jsonify({
                "success": True,
                "message": "Stream threads stopped successfully",
                "already_stopped": False
            })
        except Exception as e:
            add_log("STREAM_STOP_ERROR", f"Error stopping stream threads: {str(e)}")
            # Reset flags even on error
            shutdown_flag = False
            stop_flag = False
            stream_threads_started = False
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500


# ========= MAIN =========
if __name__ == '__main__':
    #add_log("SYSTEM_START", "AI Failover Server starting")
   
    # Initialize backup cameras (load from file or create initial entry)
    try:
        backup_cameras_list = get_backup_cameras()
    #   add_log("BACKUP_CAMERAS_INIT", f"Loaded {len(backup_cameras_list)} backup camera(s)")
        for i, cam in enumerate(backup_cameras_list, 1):
           # add_log("BACKUP_CAMERA_INFO", f"Backup Camera {i}: {cam.get('name', 'Unnamed')} - {cam.get('ip')}:{cam.get('port')}")
    except Exception as e:
       # add_log("BACKUP_CAMERAS_ERROR", f"Error loading backup cameras: {str(e)}")
        import traceback
       # add_log("BACKUP_CAMERAS_ERROR_TRACE", f"Traceback: {traceback.format_exc()}")
        backup_cameras_list = []

    # NOTE: Threads are NOT started automatically on Flask startup
    # They will be started via /stream/start endpoint when needed
    #add_log("FLASK_START", "Flask server starting (threads will start on demand)")
    
    # For Render, use environment variable PORT or default to 8000
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, threaded=True)