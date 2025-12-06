import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types/user';
import { getUserDisplayName, getUserInitials } from '../utils/userDisplay';

interface ConnectionDrawerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Node {
    id: string;
    user: User;
    x: number;
    y: number;
}

interface Connection {
    from: string;
    to: string;
}

export default function ConnectionDrawerModal({ isOpen, onClose }: ConnectionDrawerModalProps) {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ from: string; to: string; fromName: string; toName: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>();
    const basePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const nodesLengthRef = useRef(0);
    const usersListRef = useRef<User[]>([]);

    // Initialize nodes in a circular layout
    const initializeNodes = useCallback((userList: User[]) => {
        if (!containerRef.current) {
            // Wait for container to be ready
            setTimeout(() => initializeNodes(userList), 100);
            return;
        }

        const container = containerRef.current;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.35;

        const newNodes: Node[] = userList.map((user, index) => {
            const angle = (index / userList.length) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            return {
                id: user.number || `user-${user.id}`,
                user,
                x,
                y,
            };
        });

        setNodes(newNodes);
        // Reset base positions
        basePositionsRef.current.clear();
        newNodes.forEach(node => {
            basePositionsRef.current.set(node.id, { x: node.x, y: node.y });
        });
        nodesLengthRef.current = newNodes.length;
    }, []);

    // Fetch all users and existing connections
    useEffect(() => {
        if (!isOpen) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/users');
                if (!response.ok) throw new Error('Failed to fetch users');
                const usersData = await response.json();
                usersListRef.current = usersData;
                initializeNodes(usersData);

                // Fetch existing connections for all users
                const connectionsPromises = usersData.map(async (user: User) => {
                    try {
                        const profileResponse = await fetch(`/api/profile/${user.number}`);
                        if (!profileResponse.ok) return [];
                        const profileData = await profileResponse.json();
                        return (profileData.connections || []).map((conn: User) => ({
                            from: user.number || `user-${user.id}`,
                            to: conn.number || `user-${conn.id}`,
                        }));
                    } catch {
                        return [];
                    }
                });

                const allConnections = await Promise.all(connectionsPromises);
                const flattenedConnections = allConnections.flat();
                // Remove duplicates (since connections are bidirectional in the UI)
                const uniqueConnections = flattenedConnections.filter((conn, index, self) =>
                    index === self.findIndex(c =>
                        (c.from === conn.from && c.to === conn.to) ||
                        (c.from === conn.to && c.to === conn.from)
                    )
                );
                setConnections(uniqueConnections);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, initializeNodes]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setNodes([]);
            setConnections([]);
            setSelectedNode(null);
            setError(null);
            setDeleteConfirm(null);
            basePositionsRef.current.clear();
            nodesLengthRef.current = 0;
        }
    }, [isOpen]);

    // Handle window resize
    useEffect(() => {
        if (!isOpen || usersListRef.current.length === 0) return;

        const handleResize = () => {
            if (containerRef.current && usersListRef.current.length > 0) {
                initializeNodes(usersListRef.current);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isOpen, initializeNodes]);

    useEffect(() => {
        // Update base positions when nodes length changes (new nodes initialized)
        if (nodes.length !== nodesLengthRef.current) {
            nodes.forEach(node => {
                basePositionsRef.current.set(node.id, { x: node.x, y: node.y });
            });
            nodesLengthRef.current = nodes.length;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes.length]);

    useEffect(() => {
        if (nodes.length === 0 || !isOpen) return;

        const animate = () => {
            setNodes(prevNodes =>
                prevNodes.map(node => {
                    const basePos = basePositionsRef.current.get(node.id);
                    if (!basePos) return node;

                    const time = Date.now() / 1000;
                    const idHash = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

                    const offsetX = Math.sin(time * 0.4 + idHash * 0.1) * 8;
                    const offsetY = Math.cos(time * 0.5 + idHash * 0.1) * 8;

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
    }, [nodes.length, isOpen]);

    // Check if connection exists
    const connectionExists = (fromId: string, toId: string): boolean => {
        return connections.some(
            conn => (conn.from === fromId && conn.to === toId) || (conn.from === toId && conn.to === fromId)
        );
    };

    // Handle node click for connecting or deleting
    const handleNodeClick = async (nodeId: string) => {
        // If there's a delete confirmation pending, ignore clicks
        if (deleteConfirm) return;

        if (!selectedNode) {
            setSelectedNode(nodeId);
            return;
        }

        if (selectedNode === nodeId) {
            // Deselect
            setSelectedNode(null);
            return;
        }

        const fromNode = nodes.find(n => n.id === selectedNode);
        const toNode = nodes.find(n => n.id === nodeId);

        if (!fromNode || !toNode) return;

        // Check if connection already exists
        if (connectionExists(selectedNode, nodeId)) {
            // Show confirmation dialog
            setDeleteConfirm({
                from: selectedNode,
                to: nodeId,
                fromName: getUserDisplayName(fromNode.user),
                toName: getUserDisplayName(toNode.user),
            });
            setSelectedNode(null);
            return;
        }

        // Create connection
        try {
            setError(null);
            const response = await fetch(`/api/profile/${fromNode.user.number}/connections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connectedPhoneNumber: toNode.user.number,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create connection');
            }

            // Add connection to local state
            setConnections(prev => [...prev, { from: selectedNode, to: nodeId }]);
            setSelectedNode(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create connection');
            setSelectedNode(null);
        }
    };

    // Handle delete confirmation
    const handleDeleteConfirm = async (confirmed: boolean) => {
        if (!deleteConfirm) return;

        if (!confirmed) {
            setDeleteConfirm(null);
            return;
        }

        const { from, to } = deleteConfirm;
        const fromNode = nodes.find(n => n.id === from);
        const toNode = nodes.find(n => n.id === to);

        if (!fromNode || !toNode) {
            setDeleteConfirm(null);
            return;
        }

        try {
            setError(null);
            const response = await fetch(
                `/api/profile/${fromNode.user.number}/connections/${toNode.user.number}`,
                {
                    method: 'DELETE',
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete connection');
            }

            // Remove connection from local state
            setConnections(prev =>
                prev.filter(
                    conn =>
                        !((conn.from === from && conn.to === to) || (conn.from === to && conn.to === from))
                )
            );
            setDeleteConfirm(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete connection');
            setDeleteConfirm(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="connection-drawer-modal">
            <div className="connection-drawer-modal__overlay" onClick={onClose} />
            <div className="connection-drawer-modal__content">
                <div className="connection-drawer-modal__header">
                    <h2>Draw Connections</h2>
                    <button
                        className="connection-drawer-modal__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {error && (
                    <div className="connection-drawer-modal__error">
                        {error}
                        <button onClick={() => setError(null)}>×</button>
                    </div>
                )}

                <div className="connection-drawer-modal__instructions">
                    {deleteConfirm ? (
                        <p className="connection-drawer-modal__delete-warning">
                            Are you sure you want to delete the connection between{' '}
                            <strong>{deleteConfirm.fromName}</strong> and{' '}
                            <strong>{deleteConfirm.toName}</strong>?
                        </p>
                    ) : selectedNode ? (
                        <p>Click on another user to connect them</p>
                    ) : (
                        <p>Click on a user to start creating a connection</p>
                    )}
                </div>

                {deleteConfirm && (
                    <div className="connection-drawer-modal__confirm-buttons">
                        <button
                            className="connection-drawer-modal__confirm-btn connection-drawer-modal__confirm-btn--delete"
                            onClick={() => handleDeleteConfirm(true)}
                        >
                            Yes, Delete
                        </button>
                        <button
                            className="connection-drawer-modal__confirm-btn connection-drawer-modal__confirm-btn--cancel"
                            onClick={() => handleDeleteConfirm(false)}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="connection-drawer-modal__loading">
                        <div className="spinner"></div>
                        <p>Loading users...</p>
                    </div>
                ) : (
                    <div ref={containerRef} className="connection-drawer-modal__canvas">
                        {/* Draw connection lines */}
                        <svg
                            className="connection-drawer-modal__connections"
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
                            {connections.map((conn, index) => {
                                const fromNode = nodes.find(n => n.id === conn.from);
                                const toNode = nodes.find(n => n.id === conn.to);
                                if (!fromNode || !toNode) return null;

                                return (
                                    <line
                                        key={`line-${index}`}
                                        x1={fromNode.x}
                                        y1={fromNode.y}
                                        x2={toNode.x}
                                        y2={toNode.y}
                                        stroke="rgba(0, 0, 0, 0.3)"
                                        strokeWidth="2"
                                    />
                                );
                            })}
                        </svg>

                        {/* Draw nodes */}
                        {nodes.map(node => {
                            const isSelected = selectedNode === node.id;
                            const displayName = getUserDisplayName(node.user);

                            return (
                                <div
                                    key={node.id}
                                    className={`connection-drawer-modal__node ${isSelected ? 'connection-drawer-modal__node--selected' : ''}`}
                                    style={{
                                        left: `${node.x}px`,
                                        top: `${node.y}px`,
                                        transform: 'translate(-50%, -50%)',
                                    }}
                                    onClick={() => handleNodeClick(node.id)}
                                >
                                    {node.user.profile_picture ? (
                                        <img
                                            src={node.user.profile_picture}
                                            alt={displayName}
                                            className="connection-drawer-modal__node-image"
                                        />
                                    ) : (
                                        <div className="connection-drawer-modal__node-placeholder">
                                            <span className="connection-drawer-modal__node-initials">
                                                {getUserInitials(node.user)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="connection-drawer-modal__node-label">
                                        {displayName}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
