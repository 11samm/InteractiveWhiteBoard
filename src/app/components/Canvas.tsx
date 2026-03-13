import { useRef, useState, useEffect } from 'react';

interface CanvasProps {
  activeTool: string;
  theme: 'light' | 'dark';
}

export function Canvas({ activeTool, theme }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    setContext(ctx);

    const handleResize = () => {
      // Only save image data if canvas has valid dimensions
      let imageData;
      if (canvas.width > 0 && canvas.height > 0) {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'pencil' || !context) return;
    
    setIsDrawing(true);
    context.beginPath();
    context.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool !== 'pencil' || !context) return;

    context.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    context.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      className={`absolute inset-0 ${activeTool === 'pencil' ? 'cursor-crosshair' : 'cursor-default'}`}
    />
  );
}