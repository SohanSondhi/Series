import { useEffect, useRef } from 'react';

export default function ShootingStars() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const createStar = () => {
            const star = document.createElement('div');
            star.className = 'shooting-star';

            // Random starting position
            const startX = Math.random() * window.innerWidth;
            const startY = Math.random() * window.innerHeight;

            // Random direction (diagonal)
            const angle = Math.random() * Math.PI * 2;
            const distance = 2000 + Math.random() * 1000;
            const endX = startX + Math.cos(angle) * distance;
            const endY = startY + Math.sin(angle) * distance;

            // Random size
            const size = 2 + Math.random() * 3;
            const duration = 1 + Math.random() * 2;

            const deltaX = endX - startX;
            const deltaY = endY - startY;

            star.style.left = `${startX}px`;
            star.style.top = `${startY}px`;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.animationDuration = `${duration}s`;
            star.style.setProperty('--delta-x', `${deltaX}px`);
            star.style.setProperty('--delta-y', `${deltaY}px`);

            container.appendChild(star);

            // Remove star after animation
            setTimeout(() => {
                if (star.parentNode) {
                    star.parentNode.removeChild(star);
                }
            }, duration * 1000);
        };

        // Create stars periodically
        const interval = setInterval(createStar, 300);

        // Create initial stars
        for (let i = 0; i < 5; i++) {
            setTimeout(() => createStar(), i * 200);
        }

        return () => {
            clearInterval(interval);
        };
    }, []);

    return <div ref={containerRef} className="shooting-stars" />;
}
