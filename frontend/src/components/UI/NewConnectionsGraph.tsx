import { useState, useEffect, useRef, useMemo } from 'react';
import { getUserDisplayName, getUserInitials } from '../../utils/userDisplay';

interface ConnectionUser {
    id: number;
    firstName: string;
    lastName: string;
    number: string;
    profilePicture?: string | null;
}

interface NewConnectionsGraphProps {
    user: ConnectionUser;
    allConnections: ConnectionUser[];
    newConnections: ConnectionUser[];
}

interface Node {
    id: string;
    user: ConnectionUser;
    x: number;
    y: number;
    isCenter: boolean;
    isNew: boolean;
}

export default function NewConnectionsGraph({ user, allConnections, newConnections }: NewConnectionsGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [scale, setScale] = useState(0);
    const [highlightPhase, setHighlightPhase] = useState<'none' | 'all-blue' | 'new-green'>('none');
    const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
    const animationFrameRef = useRef<number>();
    const basePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const velocitiesRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
    const newConnectionIds = useMemo(() => new Set(newConnections.map(c => c.number || `user-${c.id}`)), [newConnections]);

    // Initialize nodes
    useEffect(() => {
        const initializeNodes = () => {
            if (!containerRef.current) return;

            const container = containerRef.current;
            const width = container.clientWidth;
            const height = container.clientHeight;
            const centerX = width / 2;
            const centerY = height / 2;

            // Create center node (the user)
            const centerNode: Node = {
                id: user.number || 'center',
                user,
                x: centerX,
                y: centerY,
                isCenter: true,
                isNew: false,
            };

            // Create connection nodes in a circle around the center
            const connectionNodes: Node[] = allConnections.map((conn, index) => {
                const angle = (index / allConnections.length) * 2 * Math.PI;
                const radius = Math.min(width, height) * 0.3;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;

                return {
                    id: conn.number || `conn-${index}`,
                    user: conn,
                    x,
                    y,
                    isCenter: false,
                    isNew: newConnectionIds.has(conn.number || `user-${conn.id}`),
                };
            });

            setNodes([centerNode, ...connectionNodes]);
        };

        initializeNodes();

        const handleResize = () => {
            initializeNodes();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [user, allConnections, newConnectionIds]); // newConnectionIds is memoized

    // Initialize base positions
    useEffect(() => {
        const nodesToProcess = nodes.filter(n => !n.isCenter);
        nodesToProcess.forEach(node => {
            if (!basePositionsRef.current.has(node.id)) {
                basePositionsRef.current.set(node.id, { x: node.x, y: node.y });
                velocitiesRef.current.set(node.id, {
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                });
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes.length]);

    // Animation sequence: grow -> highlight all blue -> highlight new green
    useEffect(() => {
        if (nodes.length === 0) return;

        // Start growing
        const growDuration = 1500; // 1.5 seconds to grow
        const startTime = Date.now();

        const growAnimation = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / growDuration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setScale(eased);

            if (progress < 1) {
                requestAnimationFrame(growAnimation);
            } else {
                // After growing, start highlighting all in blue
                setHighlightPhase('all-blue');
                const allNodeIds = new Set(nodes.filter(n => !n.isCenter).map(n => n.id));
                setHighlightedNodes(allNodeIds);

                // After 2 seconds, switch to highlighting only new ones in green
                setTimeout(() => {
                    setHighlightPhase('new-green');
                    const newNodeIds = new Set(
                        nodes.filter(n => !n.isCenter && n.isNew).map(n => n.id)
                    );
                    setHighlightedNodes(newNodeIds);
                }, 2000);
            }
        };

        requestAnimationFrame(growAnimation);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes.length]); // Only depend on length, not full nodes array

    // Sporadic highlighting during blue phase
    useEffect(() => {
        if (highlightPhase !== 'all-blue') return;

        const interval = setInterval(() => {
            const allNodeIds = Array.from(nodes.filter(n => !n.isCenter).map(n => n.id));
            // Randomly select 2-4 nodes to highlight
            const count = 2 + Math.floor(Math.random() * 3);
            const shuffled = [...allNodeIds].sort(() => Math.random() - 0.5);
            const selected = new Set(shuffled.slice(0, count));
            setHighlightedNodes(selected);

            // After a short delay, highlight all again
            setTimeout(() => {
                setHighlightedNodes(new Set(allNodeIds));
            }, 300);
        }, 400);

        return () => clearInterval(interval);
    }, [highlightPhase, nodes]);

    // Floating animation for connection nodes
    useEffect(() => {
        if (nodes.length === 0 || scale < 1) return;

        const animate = () => {
            setNodes(prevNodes =>
                prevNodes.map(node => {
                    if (node.isCenter) return node;

                    const basePos = basePositionsRef.current.get(node.id);
                    const velocity = velocitiesRef.current.get(node.id);
                    if (!basePos || !velocity) return node;

                    // Gentle floating effect - no velocity-based movement, just subtle sine wave
                    const time = Date.now() / 1000;
                    const idHash = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    // Reduced floating - much more subtle
                    const offsetX = Math.sin(time * 0.3 + idHash * 0.1) * 2;
                    const offsetY = Math.cos(time * 0.4 + idHash * 0.1) * 2;

                    return {
                        ...node,
                        x: basePos.x + offsetX,
                        y: basePos.y + offsetY,
                    };
                })
            );
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [nodes.length, scale]);

    const centerNode = nodes.find(n => n.isCenter);
    const connectionNodes = nodes.filter(n => !n.isCenter);

    return (
        <div ref={containerRef} className="new-connections-graph">
            <svg
                className="new-connections-graph__connections"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 1,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    opacity: scale,
                }}
            >
                {centerNode && connectionNodes.map(node => (
                    <line
                        key={`line-${node.id}`}
                        x1={centerNode.x}
                        y1={centerNode.y}
                        x2={node.x}
                        y2={node.y}
                        stroke="rgba(0, 0, 0, 0.25)"
                        strokeWidth="2"
                    />
                ))}
            </svg>

            <div
                className="new-connections-graph__nodes"
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    opacity: scale,
                }}
            >
                {nodes.map(node => {
                    const isHighlighted = highlightedNodes.has(node.id);
                    // Adapt ConnectionUser to User format for display functions
                    const userForDisplay = {
                        id: node.user.id,
                        first_name: node.user.firstName,
                        last_name: node.user.lastName,
                        number: node.user.number,
                        profile_picture: node.user.profilePicture || undefined,
                        created_at: '',
                        updated_at: '',
                    };
                    const displayName = getUserDisplayName(userForDisplay);
                    const isNew = node.isNew;

                    let nodeClass = 'new-connections-graph__node';
                    if (node.isCenter) {
                        nodeClass += ' new-connections-graph__node--center';
                    }
                    if (isHighlighted && highlightPhase === 'all-blue') {
                        nodeClass += ' new-connections-graph__node--highlight-blue';
                    }
                    // New connections are always green (after blue phase completes, or immediately if no blue phase)
                    if (isNew && (highlightPhase === 'new-green' || highlightPhase === 'none')) {
                        nodeClass += ' new-connections-graph__node--highlight-green';
                    }

                    return (
                        <div
                            key={node.id}
                            className={nodeClass}
                            style={{
                                left: `${node.x}px`,
                                top: `${node.y}px`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {node.user.profilePicture ? (
                                <img
                                    src={node.user.profilePicture}
                                    alt={displayName}
                                    className="new-connections-graph__node-image"
                                />
                            ) : (
                                <div className="new-connections-graph__node-placeholder">
                                    <span className="new-connections-graph__node-initials">
                                        {getUserInitials(userForDisplay)}
                                    </span>
                                </div>
                            )}
                            {isNew && (
                                <div className="new-connections-graph__new-badge">new!</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
