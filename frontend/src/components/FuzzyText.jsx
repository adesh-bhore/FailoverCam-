import React, { useEffect, useRef } from 'react';

const FuzzyText = ({
  children,
  fontSize = 'clamp(2rem, 10vw, 10rem)',
  fontWeight = 900,
  fontFamily = 'inherit',
  color = '#fff',
  enableHover = true,
  baseIntensity = 0.18,
  hoverIntensity = 0.5
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    let animationFrameId;
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const init = async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      if (isCancelled) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const computedFontFamily =
        fontFamily === 'inherit' ? window.getComputedStyle(canvas).fontFamily || 'sans-serif' : fontFamily;

      const fontSizeStr = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;
      let numericFontSize;
      if (typeof fontSize === 'number') {
        numericFontSize = fontSize;
      } else {
        const temp = document.createElement('span');
        temp.style.fontSize = fontSize;
        document.body.appendChild(temp);
        const computedSize = window.getComputedStyle(temp).fontSize;
        numericFontSize = parseFloat(computedSize);
        document.body.removeChild(temp);
      }

      // Helper function to extract text segments with their colors
      const extractTextSegments = (children, defaultColor = color) => {
        const segments = [];
        
        React.Children.toArray(children).forEach(child => {
          if (typeof child === 'string' || typeof child === 'number') {
            segments.push({ text: String(child), color: defaultColor });
          } else if (React.isValidElement(child)) {
            // Check if it's a span with a color style
            const childColor = child.props?.style?.color || defaultColor;
            if (child.props.children) {
              const childSegments = extractTextSegments(child.props.children, childColor);
              segments.push(...childSegments);
            }
          }
        });
        
        return segments;
      };
      
      const textSegments = extractTextSegments(children);

      // Create a temporary canvas for measuring text
      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      if (!measureCtx) return;

      // Measure all segments to determine dimensions and positions
      let totalWidth = 0;
      let maxAscent = 0;
      let maxDescent = 0;
      let maxHeight = 0;
      const segmentXOffsets = [];

      measureCtx.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      measureCtx.textBaseline = 'alphabetic';

      // First pass: measure all segments to determine total dimensions
      textSegments.forEach((segment) => {
        const metrics = measureCtx.measureText(segment.text);
        const actualAscent = metrics.actualBoundingBoxAscent ?? numericFontSize;
        const actualDescent = metrics.actualBoundingBoxDescent ?? numericFontSize * 0.2;

        maxAscent = Math.max(maxAscent, actualAscent);
        maxDescent = Math.max(maxDescent, actualDescent);
        maxHeight = Math.max(maxHeight, Math.ceil(actualAscent + actualDescent));
      });

      // Calculate cumulative positions for each segment
      let currentX = 0;
      textSegments.forEach((segment) => {
        segmentXOffsets.push(currentX);
        const metrics = measureCtx.measureText(segment.text);
        currentX += metrics.width;
      });
      totalWidth = currentX;

      // Create main offscreen canvas
      const offscreen = document.createElement('canvas');
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      const extraWidthBuffer = 10;
      const textBoundingWidth = totalWidth;
      const tightHeight = maxHeight;

      offscreen.width = textBoundingWidth + extraWidthBuffer * 2;
      offscreen.height = tightHeight;

      // Render each segment with its color at the correct position
      offCtx.font = `${fontWeight} ${fontSizeStr} ${computedFontFamily}`;
      offCtx.textBaseline = 'alphabetic';
      
      const baseXOffset = extraWidthBuffer;
      textSegments.forEach((segment, index) => {
        const x = baseXOffset + segmentXOffsets[index];
        offCtx.fillStyle = segment.color;
        offCtx.fillText(segment.text, x, maxAscent);
      });

      const offscreenWidth = offscreen.width;

      const horizontalMargin = 50;
      const verticalMargin = 0;
      canvas.width = offscreenWidth + horizontalMargin * 2;
      canvas.height = tightHeight + verticalMargin * 2;
      ctx.translate(horizontalMargin, verticalMargin);

      const interactiveLeft = horizontalMargin + baseXOffset;
      const interactiveTop = verticalMargin;
      const interactiveRight = interactiveLeft + textBoundingWidth;
      const interactiveBottom = interactiveTop + tightHeight;

      let isHovering = false;
      const fuzzRange = 30;

      const run = () => {
        if (isCancelled) return;
        ctx.clearRect(-fuzzRange, -fuzzRange, offscreenWidth + 2 * fuzzRange, tightHeight + 2 * fuzzRange);
        const intensity = isHovering ? hoverIntensity : baseIntensity;
        for (let j = 0; j < tightHeight; j++) {
          const dx = Math.floor(intensity * (Math.random() - 0.5) * fuzzRange);
          ctx.drawImage(offscreen, 0, j, offscreenWidth, 1, dx, j, offscreenWidth, 1);
        }
        animationFrameId = window.requestAnimationFrame(run);
      };

      run();

      const isInsideTextArea = (x, y) => {
        return x >= interactiveLeft && x <= interactiveRight && y >= interactiveTop && y <= interactiveBottom;
      };

      const handleMouseMove = e => {
        if (!enableHover) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        isHovering = isInsideTextArea(x, y);
      };

      const handleMouseLeave = () => {
        isHovering = false;
      };

      const handleTouchMove = e => {
        if (!enableHover) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        isHovering = isInsideTextArea(x, y);
      };

      const handleTouchEnd = () => {
        isHovering = false;
      };

      if (enableHover) {
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);
      }

      const cleanup = () => {
        window.cancelAnimationFrame(animationFrameId);
        if (enableHover) {
          canvas.removeEventListener('mousemove', handleMouseMove);
          canvas.removeEventListener('mouseleave', handleMouseLeave);
          canvas.removeEventListener('touchmove', handleTouchMove);
          canvas.removeEventListener('touchend', handleTouchEnd);
        }
      };

      canvas.cleanupFuzzyText = cleanup;
    };

    init();

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      if (canvas && canvas.cleanupFuzzyText) {
        canvas.cleanupFuzzyText();
      }
    };
  }, [children, fontSize, fontWeight, fontFamily, color, enableHover, baseIntensity, hoverIntensity]);

  return <canvas ref={canvasRef} />;
};

export default FuzzyText;
