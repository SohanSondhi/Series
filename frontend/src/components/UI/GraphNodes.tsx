import { useState, useEffect, useRef } from 'react';

interface Node {
    id: number;
    x: number;
    y: number;
    connections: number[];
}

interface GraphNodesProps {
    nodeCount?: number;
    slowMovement?: boolean;
}

export default function GraphNodes({ nodeCount = 15, slowMovement = false }: GraphNodesProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes] = useState<Node[]>([]);
    const animationFrameRef = useRef<number>();

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Initialize nodes with random positions
        const initialNodes: Node[] = Array.from({ length: nodeCount }, (_, i) => {
            // Place nodes on the sides (left and right)
            const side = i % 2 === 0 ? 'left' : 'right';
            const x = side === 'left'
                ? Math.random() * (width * 0.2) + 10
                : width - Math.random() * (width * 0.2) - 10;
            const y = Math.random() * height;

            // Create connections (each node connects to 2-3 others)
            const connections: number[] = [];
            const connectionCount = Math.floor(Math.random() * 2) + 2;
            for (let j = 0; j < connectionCount && j < nodeCount; j++) {
                const targetId = (i + j + 1) % nodeCount;
                if (targetId !== i && !connections.includes(targetId)) {
                    connections.push(targetId);
                }
            }

            return {
                id: i,
                x,
                y,
                connections,
            };
        });

        setNodes(initialNodes);
    }, [nodeCount]);

    // Auto-animate nodes with natural floating
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Initialize velocities for each node - more dramatic movement
        nodes.forEach((node) => {
            if (!velocitiesRef.current.has(node.id)) {
                velocitiesRef.current.set(node.id, {
                    vx: (Math.random() - 0.5) * 1.5, // Increased from 0.5 to 1.5
                    vy: (Math.random() - 0.5) * 1.5, // Increased from 0.5 to 1.5
                });
            }
        });

        const animate = () => {
            setNodes(prevNodes =>
                prevNodes.map((node) => {
                    const vel = velocitiesRef.current.get(node.id) || { vx: 0, vy: 0 };

                    // Add more dramatic random variation
                    vel.vx += (Math.random() - 0.5) * 0.05; // Increased from 0.02
                    vel.vy += (Math.random() - 0.5) * 0.05; // Increased from 0.02

                    // Less damping for more dramatic movement
                    vel.vx *= 0.98; // Increased from 0.96
                    vel.vy *= 0.98; // Increased from 0.96

                    const newX = node.x + vel.vx;
                    const newY = node.y + vel.vy;

                    // Bounce off walls with more dramatic energy
                    if (newX < 10 || newX > width - 30) {
                        vel.vx *= -1.1; // Increased bounce from -0.9
                        vel.vy *= 0.98; // Less friction
                    }
                    if (newY < 10 || newY > height - 30) {
                        vel.vy *= -1.1; // Increased bounce from -0.9
                        vel.vx *= 0.98; // Less friction
                    }

                    // Keep nodes within bounds
                    const constrainedX = Math.max(10, Math.min(width - 30, newX));
                    const constrainedY = Math.max(10, Math.min(height - 30, newY));

                    velocitiesRef.current.set(node.id, vel);
                    return { ...node, x: constrainedX, y: constrainedY };
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

    // Track mouse position and velocity for dramatic ricochet
    const mousePosRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, velocity: 0 });
    const velocitiesRef = useRef<Map<number, { vx: number; vy: number }>>(new Map());

    // Repel nodes from cursor with velocity-based ricochet
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate mouse velocity
        const dx = mouseX - mousePosRef.current.lastX;
        const dy = mouseY - mousePosRef.current.lastY;
        const mouseVelocity = Math.sqrt(dx * dx + dy * dy);
        mousePosRef.current.velocity = mouseVelocity;
        mousePosRef.current.lastX = mouseX;
        mousePosRef.current.lastY = mouseY;
        mousePosRef.current.x = mouseX;
        mousePosRef.current.y = mouseY;

        const repelRadius = 150;
        const baseRepelStrength = 8;
        // Increase repel strength based on mouse velocity (faster mouse = stronger push)
        const velocityMultiplier = Math.min(1 + mouseVelocity / 50, 3); // Up to 3x stronger
        const repelStrength = baseRepelStrength * velocityMultiplier;

        setNodes(prevNodes =>
            prevNodes.map(node => {
                const nodeCenterX = node.x + 10;
                const nodeCenterY = node.y + 10;
                const dx = nodeCenterX - mouseX;
                const dy = nodeCenterY - mouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < repelRadius && distance > 0) {
                    // Calculate force based on distance and mouse velocity
                    const distanceForce = (repelRadius - distance) / repelRadius;
                    const angle = Math.atan2(dy, dx);

                    // Apply velocity to node (ricochet effect)
                    const existingVel = velocitiesRef.current.get(node.id) || { vx: 0, vy: 0 };
                    const pushForce = distanceForce * repelStrength;
                    existingVel.vx += Math.cos(angle) * pushForce * 0.3;
                    existingVel.vy += Math.sin(angle) * pushForce * 0.3;

                    // Apply immediate position change
                    const newX = node.x + Math.cos(angle) * pushForce;
                    const newY = node.y + Math.sin(angle) * pushForce;

                    // Keep nodes within bounds
                    const width = rect.width;
                    const height = rect.height;
                    const constrainedX = Math.max(10, Math.min(width - 30, newX));
                    const constrainedY = Math.max(10, Math.min(height - 30, newY));

                    velocitiesRef.current.set(node.id, existingVel);
                    return { ...node, x: constrainedX, y: constrainedY };
                }
                return node;
            })
        );
    };

    return (
        <div
            ref={containerRef}
            className={`graph-nodes ${slowMovement ? 'graph-nodes--slow' : ''}`}
            onMouseMove={handleMouseMove}
        >
            {/* Draw connections */}
            <svg className="graph-nodes__connections" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                {nodes.map(node =>
                    node.connections.map(connectionId => {
                        const targetNode = nodes.find(n => n.id === connectionId);
                        if (!targetNode) return null;
                        return (
                            <line
                                key={`${node.id}-${connectionId}`}
                                x1={node.x + 10}
                                y1={node.y + 10}
                                x2={targetNode.x + 10}
                                y2={targetNode.y + 10}
                                stroke="rgba(0, 0, 0, 0.1)"
                                strokeWidth="1"
                            />
                        );
                    })
                )}
            </svg>

            {/* Draw nodes */}
            {nodes.map(node => (
                <div
                    key={node.id}
                    className="graph-nodes__node"
                    style={{
                        left: `${node.x}px`,
                        top: `${node.y}px`,
                    }}
                />
            ))}
        </div>
    );
}
