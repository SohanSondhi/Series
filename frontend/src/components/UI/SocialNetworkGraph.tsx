import { useState, useEffect, useRef } from 'react';
import { User } from '../../types/user';
import { getUserDisplayName, getUserInitials } from '../../utils/userDisplay';

interface SocialNetworkGraphProps {
    user: User;
    connections: User[];
}

interface Node {
    id: string;
    user: User;
    x: number;
    y: number;
    isCenter: boolean;
}

export default function SocialNetworkGraph({ user, connections }: SocialNetworkGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const animationFrameRef = useRef<number>();
    const basePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const velocitiesRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());

    // Initialize nodes and handle resize
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
            };

            // Create connection nodes in a circle around the center
            const connectionNodes: Node[] = connections.map((conn, index) => {
                const angle = (index / connections.length) * 2 * Math.PI;
                const radius = Math.min(width, height) * 0.3;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;

                return {
                    id: conn.number || `conn-${index}`,
                    user: conn,
                    x,
                    y,
                    isCenter: false,
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
    }, [user, connections]);

    // Initialize base positions when nodes are set
    useEffect(() => {
        nodes.forEach(node => {
            if (!node.isCenter) {
                if (!basePositionsRef.current.has(node.id)) {
                    basePositionsRef.current.set(node.id, { x: node.x, y: node.y });
                    // Initialize with random velocities for more organic movement
                    velocitiesRef.current.set(node.id, {
                        vx: (Math.random() - 0.5) * 0.3,
                        vy: (Math.random() - 0.5) * 0.3,
                    });
                }
            }
        });
    }, [nodes]);

    // Dynamic floating animation for connection nodes - more dramatic movement
    useEffect(() => {
        if (nodes.length === 0) return;

        const animate = () => {
            setNodes(prevNodes =>
                prevNodes.map(node => {
                    if (node.isCenter) return node; // Don't animate center node

                    const basePos = basePositionsRef.current.get(node.id);
                    const vel = velocitiesRef.current.get(node.id);
                    if (!basePos || !vel) return node;

                    // More dynamic floating with multiple sine waves for organic movement
                    const time = Date.now() / 1000;
                    const idHash = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

                    // Multiple frequency components for more complex motion
                    const offsetX =
                        Math.sin(time * 0.3 + idHash * 0.1) * 15 +
                        Math.sin(time * 0.7 + idHash * 0.2) * 8 +
                        Math.cos(time * 0.5 + idHash * 0.15) * 5;

                    const offsetY =
                        Math.cos(time * 0.4 + idHash * 0.1) * 15 +
                        Math.cos(time * 0.6 + idHash * 0.2) * 8 +
                        Math.sin(time * 0.5 + idHash * 0.15) * 5;

                    // Add velocity-based movement for more organic feel
                    vel.vx += (Math.random() - 0.5) * 0.01;
                    vel.vy += (Math.random() - 0.5) * 0.01;
                    vel.vx *= 0.98; // Damping
                    vel.vy *= 0.98;

                    const newX = basePos.x + offsetX + vel.vx * 10;
                    const newY = basePos.y + offsetY + vel.vy * 10;

                    velocitiesRef.current.set(node.id, vel);

                    return {
                        ...node,
                        x: newX,
                        y: newY,
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
    }, [nodes.length]);

    return (
        <div ref={containerRef} className="social-network-graph">
            {/* Draw connection lines */}
            <svg
                className="social-network-graph__connections"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 1,
                }}
            >
                {nodes
                    .filter(node => !node.isCenter)
                    .map(node => {
                        const centerNode = nodes.find(n => n.isCenter);
                        if (!centerNode) return null;

                        return (
                            <line
                                key={`line-${node.id}`}
                                x1={centerNode.x}
                                y1={centerNode.y}
                                x2={node.x}
                                y2={node.y}
                                stroke="rgba(0, 0, 0, 0.25)"
                                strokeWidth="2"
                            />
                        );
                    })}
            </svg>

            {/* Draw nodes */}
            {nodes.map(node => {
                const isHovered = hoveredNode === node.id;
                const displayName = getUserDisplayName(node.user);

                return (
                    <div
                        key={node.id}
                        className={`social-network-graph__node ${node.isCenter ? 'social-network-graph__node--center' : ''} ${isHovered ? 'social-network-graph__node--hovered' : ''}`}
                        style={{
                            left: `${node.x}px`,
                            top: `${node.y}px`,
                            transform: 'translate(-50%, -50%)',
                        }}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                    >
                        {node.user.profile_picture ? (
                            <img
                                src={node.user.profile_picture}
                                alt={displayName}
                                className="social-network-graph__node-image"
                            />
                        ) : (
                            <div className="social-network-graph__node-placeholder">
                                <span className="social-network-graph__node-initials">
                                    {getUserInitials(node.user)}
                                </span>
                            </div>
                        )}
                        {isHovered && !node.isCenter && (
                            <div className="social-network-graph__node-tooltip">
                                {displayName}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
