import { useEffect, useState, useRef } from 'react';
import GraphNodes from './GraphNodes';

interface WrappedLogoAnimationProps {
    onComplete: () => void;
}

export default function WrappedLogoAnimation({ onComplete }: WrappedLogoAnimationProps) {
    const [showContent, setShowContent] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        // Show content after a brief delay
        const showTimer = setTimeout(() => {
            setShowContent(true);
        }, 100);

        // Complete after 5 seconds
        timeoutRef.current = setTimeout(() => {
            onComplete();
        }, 4000);

        return () => {
            clearTimeout(showTimer);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [onComplete]);

    return (
        <div className="wrapped-logo-animation">
            <div className="wrapped-logo-animation__nodes-left">
                <GraphNodes nodeCount={12} slowMovement={true} />
            </div>
            <div className="wrapped-logo-animation__nodes-right">
                <GraphNodes nodeCount={12} slowMovement={true} />
            </div>
            <div className={`wrapped-logo-animation__content ${showContent ? 'wrapped-logo-animation__content--visible' : ''}`}>
                <div className="wrapped-logo-animation__logo">
                    <span className="wrapped-logo-animation__logo-text">S.</span>
                </div>
                <div className="wrapped-logo-animation__subtitle">Series</div>
            </div>
        </div>
    );
}
