/**
 * Voice Announcer Utility
 * 
 * Uses Web Speech API for text-to-speech announcements
 * during critical system events like camera failover
 */

class VoiceAnnouncer {
    constructor() {
        // Voice alerts enabled by default (as per user requirement)
        this.enabled = localStorage.getItem('voiceAlertsEnabled') !== 'false'
        this.rate = 1.0  // Speech rate (0.1 to 10)
        this.pitch = 1.0  // Speech pitch (0 to 2)
        this.volume = 1.0  // Speech volume (0 to 1)
    }

    /**
     * Speak a message using browser's text-to-speech
     * @param {string} message - The text to speak
     */
    speak(message) {
        if (!this.enabled || !message) {
            return
        }

        // Check browser support
        if (!('speechSynthesis' in window)) {
            console.warn('Speech synthesis not supported in this browser')
            return
        }

        try {
            // Cancel any ongoing speech to avoid overlap
            window.speechSynthesis.cancel()

            // Create speech utterance
            const utterance = new SpeechSynthesisUtterance(message)
            utterance.rate = this.rate
            utterance.pitch = this.pitch
            utterance.volume = this.volume
            utterance.lang = 'en-US'

            // Optional: Add event listeners
            utterance.onstart = () => {
                console.log('Voice announcement started:', message)
            }

            utterance.onend = () => {
                console.log('Voice announcement completed')
            }

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error)
            }

            // Speak the message
            window.speechSynthesis.speak(utterance)

        } catch (error) {
            console.error('Error in voice announcement:', error)
        }
    }

    /**
     * Enable or disable voice alerts
     * @param {boolean} enabled - True to enable, false to disable
     */
    setEnabled(enabled) {
        this.enabled = enabled
        localStorage.setItem('voiceAlertsEnabled', enabled.toString())
        console.log('Voice alerts:', enabled ? 'enabled' : 'disabled')
    }

    /**
     * Check if voice alerts are enabled
     * @returns {boolean} True if enabled
     */
    isEnabled() {
        return this.enabled
    }

    /**
     * Set speech rate
     * @param {number} rate - Speech rate (0.1 to 10, default 1.0)
     */
    setRate(rate) {
        this.rate = Math.max(0.1, Math.min(10, rate))
    }

    /**
     * Set speech pitch
     * @param {number} pitch - Speech pitch (0 to 2, default 1.0)
     */
    setPitch(pitch) {
        this.pitch = Math.max(0, Math.min(2, pitch))
    }

    /**
     * Set speech volume
     * @param {number} volume - Speech volume (0 to 1, default 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume))
    }

    /**
     * Test the voice announcer
     */
    test() {
        this.speak('Voice announcements are working correctly')
    }
}

// Export singleton instance
export default new VoiceAnnouncer()
