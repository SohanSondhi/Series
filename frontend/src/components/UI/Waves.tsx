import { useEffect, useRef, useState } from 'react';

export default function Waves() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>();
    const timeRef = useRef(0);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible) {
                        setIsVisible(true);
                    }
                });
            },
            { threshold: 0.5 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, [isVisible]);

    useEffect(() => {
        if (!isVisible || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const drawWave = (ctx: CanvasRenderingContext2D, time: number, amplitude: number, frequency: number, phase: number, yOffset: number) => {
            ctx.beginPath();
            const width = canvas.width;
            const height = canvas.height;

            for (let x = 0; x <= width; x += 2) {
                const y = height / 2 + yOffset + amplitude * Math.sin((x * frequency + time * 0.5 + phase) * 0.01);
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
        };

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            timeRef.current += 0.05;
            const time = timeRef.current;

            // Draw multiple waves with different phases
            const waveCount = 4;
            for (let i = 0; i < waveCount; i++) {
                const amplitude = 30 + i * 15;
                const frequency = 0.5 + i * 0.2;
                const phase = (i * Math.PI * 2) / waveCount;
                const yOffset = (i - waveCount / 2) * 40;

                // Draw in and out effect
                const drawProgress = (Math.sin(time * 0.3 + i) + 1) / 2;
                if (drawProgress > 0.1) {
                    ctx.globalAlpha = drawProgress * 0.6;
                    drawWave(ctx, time, amplitude, frequency, phase, yOffset);
                    ctx.globalAlpha = 1;
                }
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isVisible]);

    return (
        <div ref={containerRef} className="waves">
            <canvas ref={canvasRef} className="waves__canvas" />
        </div>
    );
}
