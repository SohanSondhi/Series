import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedNumber from './UI/AnimatedNumber';
import AnimatedText from './UI/AnimatedText';
import LoopingCurvedLines from './UI/LoopingCurvedLines';
import Waves from './UI/Waves';
import FloatingParticles from './UI/FloatingParticles';
import RippleEffect from './UI/RippleEffect';
import GradientOrbs from './UI/GradientOrbs';
import NewConnectionsGraph from './UI/NewConnectionsGraph';
import { getUserDisplayName } from '../utils/userDisplay';

function IntroSlide({
    content,
    onComplete,
    scrollContainerRef
}: {
    content: string;
    onComplete: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}) {
    return (
        <div className="wrapped-slide wrapped-slide--intro">
            <AnimatedText
                text={content}
                className="wrapped-slide__title"
                onComplete={onComplete}
                scrollContainerRef={scrollContainerRef}
            />
        </div>
    );
}

function MostActiveDaySlide({ dayName, messageCount }: { dayName: string; messageCount: number }) {
    const [isVisible, setIsVisible] = useState(false);
    const [showMessage, setShowMessage] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible) {
                        setIsVisible(true);
                        // Show message text after day animation completes (3 seconds)
                        setTimeout(() => {
                            setShowMessage(true);
                        }, 3000);
                    }
                });
            },
            { threshold: 0.5 }
        );

        const currentContainer = containerRef.current;
        if (currentContainer) {
            observer.observe(currentContainer);
        }

        return () => {
            if (currentContainer) {
                observer.unobserve(currentContainer);
            }
        };
    }, [isVisible]);

    return (
        <div ref={containerRef} className="wrapped-slide wrapped-slide--most-active-day">
            <FloatingParticles count={20} />
            {isVisible && (
                <>
                    <div className="wrapped-slide__most-active-day-day-text">
                        On {dayName}
                    </div>
                    {showMessage && (
                        <div className="wrapped-slide__most-active-day-message-text">
                            you had a total of
                            <AnimatedNumber
                                value={messageCount}
                                duration={1000}
                                className="wrapped-slide__most-active-day-count"
                            />
                            messages
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

interface WrappedSlidesProps {
    statistics: {
        totalMessages: number;
        messagesSent: number;
        messagesReceived: number;
    };
    twitterRecap: string | null;
    userName: string;
    phoneNumber?: string;
    allStatistics?: {
        connectionCount: number;
        newConnectionsThisWeek?: number;
        averageMessageLength: number;
        longestMessage: {
            text: string;
            length: number;
            timestamp: string;
        } | null;
        dateRange: {
            firstMessage: string;
            lastMessage: string;
        } | null;
        mostActiveDay: {
            date: string;
            messageCount: number;
        } | null;
    };
    breakdown?: {
        topContacts: Array<{
            phoneNumber: string;
            messageCount: number;
            name: string | null;
        }>;
        messagesByDayOfWeek: Array<{
            day: string;
            dayNumber: number;
            count: number;
        }>;
        messagesByHour: Array<{
            hour: number;
            count: number;
        }>;
    };
    connectionsWrapped?: {
        connections: Array<{
            user: {
                id: number;
                firstName: string;
                lastName: string;
                phoneNumber: string;
                twitter?: string;
                profilePicture?: string | null;
            };
            wrapped: {
                statistics: {
                    totalMessages: number;
                    messagesSent: number;
                    messagesReceived: number;
                    connectionCount: number;
                };
                twitterWrapped?: {
                    weeklyRecap: string | null;
                } | null;
            };
        }>;
    } | null;
    newConnections?: Array<{
        id: number;
        firstName: string;
        lastName: string;
        number: string;
        profilePicture?: string | null;
        connectionCreatedAt: string | null;
    }>;
    user?: {
        id: number;
        firstName: string;
        lastName: string;
        phoneNumber: string;
    };
}

type Slide =
    | { type: 'intro'; content: string }
    | { type: 'stat'; title: string; value: number; label: string }
    | { type: 'twitter'; content: string | null }
    | { type: 'mostActiveDay'; date: string; messageCount: number }
    | { type: 'topContact'; phoneNumber: string; messageCount: number; name: string | null }
    | { type: 'newConnections'; count: number; newConnections: Array<{ id: number; firstName: string; lastName: string; number: string; profilePicture?: string | null }>; allConnections: Array<{ id: number; firstName: string; lastName: string; number: string; profilePicture?: string | null }> }
    | { type: 'connectionsIntro'; content: string }
    | { type: 'connectionTwitter'; userName: string; recap: string | null }
    | { type: 'competition'; label: string; metric: 'totalMessages' | 'connectionCount'; userValue: number; connections: Array<{ name: string; value: number }> }
    | {
        type: 'summary';
        statistics: {
            totalMessages: number;
            messagesSent: number;
            messagesReceived: number;
            connectionCount?: number;
            averageMessageLength?: number;
            longestMessage?: { text: string; length: number; timestamp: string } | null;
            dateRange?: { firstMessage: string; lastMessage: string } | null;
        }
    };

function ConnectionsIntroSlide({
    content,
    onComplete
}: {
    content: string;
    onComplete: () => void;
}) {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible) {
                        setIsVisible(true);
                        // Call onComplete after animation finishes (5s animation + 0.3s buffer)
                        setTimeout(() => {
                            onComplete();
                        }, 5000);
                    }
                });
            },
            { threshold: 0.5 }
        );

        const currentContainer = containerRef.current;
        if (currentContainer) {
            observer.observe(currentContainer);
        }

        return () => {
            if (currentContainer) {
                observer.unobserve(currentContainer);
            }
        };
    }, [isVisible, onComplete]);

    return (
        <div ref={containerRef} className="wrapped-slide wrapped-slide--connections-intro">
            {isVisible && (
                <div className="wrapped-slide__connections-intro-text">
                    {content}
                </div>
            )}
        </div>
    );
}

function ConnectionTwitterSlide({ userName, recap }: { userName: string; recap: string | null }) {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

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

        const currentContainer = containerRef.current;
        if (currentContainer) {
            observer.observe(currentContainer);
        }

        return () => {
            if (currentContainer) {
                observer.unobserve(currentContainer);
            }
        };
    }, [isVisible]);

    return (
        <div ref={containerRef} className="wrapped-slide wrapped-slide--connection-twitter">
            <LoopingCurvedLines side="left" />
            <div className="wrapped-slide__twitter-container">
                <h2 className="wrapped-slide__title">{userName}'s Twitter Recap</h2>
                <div className="wrapped-slide__twitter-content-wrapper">
                    {recap ? (
                        <div className="wrapped-slide__twitter-content">
                            {parseTwitterRecap(recap)}
                        </div>
                    ) : (
                        <p>No Twitter recap available</p>
                    )}
                </div>
            </div>
            <LoopingCurvedLines side="right" />
        </div>
    );
}

function CompetitionChartSlide({
    label,
    userValue,
    connections
}: {
    label: string;
    userValue: number;
    connections: Array<{ name: string; value: number }>;
}) {
    const [isVisible, setIsVisible] = useState(false);
    const [animationStarted, setAnimationStarted] = useState(false);
    const [animationCompleted, setAnimationCompleted] = useState(false);
    const [racingComplete, setRacingComplete] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Prepare data for comparison - combine user and connections
    const allData = [
        { name: 'You', value: userValue },
        ...connections.map(c => ({ name: c.name, value: c.value }))
    ];

    // Find max value for scaling
    const maxValue = Math.max(...allData.map(d => d.value), 1);

    // Check for ties - find all indices with the max value
    const winnerIndices = allData
        .map((d, idx) => d.value === maxValue ? idx : -1)
        .filter(idx => idx !== -1);
    const isTie = winnerIndices.length > 1;
    const winnerIndex = winnerIndices[0]; // Use first winner index for animation timing

    // Create animation timing for each bar
    // The winner should finish last (slowest), others finish faster
    // One non-winner should start fast (teasing) but slow down
    const getAnimationDuration = (index: number, isWinner: boolean) => {
        if (isWinner) {
            return 3.8; // Winner finishes last - longest duration
        }
        // Pick one non-winner to be the "teaser" - starts fast but slows
        const teaserIndex = winnerIndex === 0 ? 1 : 0;
        if (index === teaserIndex) {
            return 3.2; // Teaser finishes before winner but after others
        }
        // Others finish quickly - varying speeds for racing effect
        return 2.2 + (index * 0.15);
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible) {
                        setIsVisible(true);
                        // Start animation after a brief delay
                        setTimeout(() => {
                            setAnimationStarted(true);
                            // Calculate the longest animation duration (winner's duration + delay)
                            const maxDuration = Math.max(
                                ...allData.map((_person, idx) => {
                                    const isWinner = winnerIndices.includes(idx);
                                    const duration = getAnimationDuration(idx, isWinner);
                                    const delay = isWinner ? idx * 0.2 : idx * 0.1;
                                    return duration + delay;
                                })
                            );
                            // Mark racing as complete after the longest animation finishes
                            setTimeout(() => {
                                setRacingComplete(true);
                                // Then mark animation as completed after color change delay
                                setTimeout(() => {
                                    setAnimationCompleted(true);
                                }, 600); // Color change animation duration
                            }, maxDuration * 1000);
                        }, 300);
                    }
                });
            },
            { threshold: 0.5 }
        );

        const currentContainer = containerRef.current;
        if (currentContainer) {
            observer.observe(currentContainer);
        }

        return () => {
            if (currentContainer) {
                observer.unobserve(currentContainer);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible]);

    return (
        <div ref={containerRef} className="wrapped-slide wrapped-slide--competition">
            <GradientOrbs count={4} />
            {isVisible && (
                <>
                    <h2 className="wrapped-slide__title">How You Compare</h2>
                    <div className="wrapped-slide__competition-label">{label}</div>
                    <div className="wrapped-slide__competition-chart">
                        {allData.map((person, index) => {
                            const percentage = (person.value / maxValue) * 100;
                            const isWinner = winnerIndices.includes(index);
                            const duration = getAnimationDuration(index, isWinner);
                            // Stagger the start slightly for racing effect - winner starts a bit later
                            const delay = isWinner ? index * 0.2 : index * 0.1;

                            // Calculate start width - all bars start at 25% of their target
                            const startWidth = percentage * 0.25;

                            return (
                                <div key={index} className="wrapped-slide__competition-bar-wrapper">
                                    <div className="wrapped-slide__competition-bar-label">{person.name}</div>
                                    <div className="wrapped-slide__competition-bar-container">
                                        <div
                                            className={`wrapped-slide__competition-bar ${animationStarted && !racingComplete ? 'wrapped-slide__competition-bar--racing' : ''} ${animationCompleted && isWinner ? (isTie ? 'wrapped-slide__competition-bar--tie' : 'wrapped-slide__competition-bar--winner') : ''}`}
                                            style={{
                                                '--target-width': `${percentage}%`,
                                                '--start-width': `${startWidth}%`,
                                                '--animation-duration': `${duration}s`,
                                                '--animation-delay': `${delay}s`,
                                                // Preserve final width after animation completes
                                                width: racingComplete ? `${percentage}%` : undefined,
                                            } as React.CSSProperties}
                                        >
                                            <span className="wrapped-slide__competition-bar-value">
                                                {person.value}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

function TopContactSlide({ phoneNumber, messageCount, name }: { phoneNumber: string; messageCount: number; name: string | null }) {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

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

        const currentContainer = containerRef.current;
        if (currentContainer) {
            observer.observe(currentContainer);
        }

        return () => {
            if (currentContainer) {
                observer.unobserve(currentContainer);
            }
        };
    }, [isVisible]);

    // Format phone number nicely: (XXX) XXX-XXXX
    const formatPhoneNumber = (phone: string) => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return phone;
    };

    // Determine display name: use name if available, otherwise format phone number
    const displayName = name || formatPhoneNumber(phoneNumber);

    return (
        <div ref={containerRef} className="wrapped-slide wrapped-slide--top-contact">
            <RippleEffect />
            {isVisible && (
                <>
                    <div className="wrapped-slide__top-contact-title">
                        You messaged this person the most
                    </div>
                    <div className="wrapped-slide__top-contact-phone">
                        {displayName}
                    </div>
                    <div className="wrapped-slide__top-contact-count">
                        <AnimatedNumber
                            value={messageCount}
                            duration={1000}
                            className="wrapped-slide__top-contact-count-number"
                        />
                        <span className="wrapped-slide__top-contact-count-label">messages</span>
                    </div>
                </>
            )}
        </div>
    );
}

function NewConnectionsSlide({ count, newConnections, allConnections, user }: { count: number; newConnections: Array<{ id: number; firstName: string; lastName: string; number: string; profilePicture?: string | null }>; allConnections: Array<{ id: number; firstName: string; lastName: string; number: string; profilePicture?: string | null }>; user: { id: number; firstName: string; lastName: string; phoneNumber: string } }) {
    const [isVisible, setIsVisible] = useState(false);
    const [showNumber, setShowNumber] = useState(true);
    const [showGraph, setShowGraph] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible) {
                        setIsVisible(true);
                        // After number animation completes (1s) + stays for 2s, fade out and show graph
                        setTimeout(() => {
                            setShowNumber(false);
                            // After fade out completes (0.5s), show graph
                            setTimeout(() => {
                                setShowGraph(true);
                            }, 500);
                        }, 3000); // 1s animation + 2s display = 3s total
                    }
                });
            },
            { threshold: 0.5 }
        );

        const currentContainer = containerRef.current;
        if (currentContainer) {
            observer.observe(currentContainer);
        }

        return () => {
            if (currentContainer) {
                observer.unobserve(currentContainer);
            }
        };
    }, [isVisible]);

    return (
        <div ref={containerRef} className="wrapped-slide wrapped-slide--new-connections">
            {isVisible && (
                <>
                    <h2 className={`wrapped-slide__title wrapped-slide__title--new-connections ${showGraph ? 'wrapped-slide__title--graph-visible' : ''}`}>
                        This week you made
                    </h2>
                    <div className={`wrapped-slide__new-connections-count ${!showNumber ? 'wrapped-slide__new-connections-count--fade-out' : ''}`}>
                        <AnimatedNumber
                            value={count}
                            duration={1000}
                            className="wrapped-slide__new-connections-number"
                        />
                        <span className="wrapped-slide__new-connections-label">
                            {count === 1 ? 'new connection' : 'new connections'}
                        </span>
                    </div>
                    {showGraph && (
                        <div className="wrapped-slide__new-connections-graph-container">
                            <NewConnectionsGraph
                                user={{
                                    id: user.id,
                                    firstName: user.firstName,
                                    lastName: user.lastName,
                                    number: user.phoneNumber,
                                }}
                                allConnections={allConnections}
                                newConnections={newConnections}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function WrappedSlides({ statistics, twitterRecap, phoneNumber, allStatistics, breakdown, connectionsWrapped, newConnections, user }: WrappedSlidesProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const hasScrolledRef = useRef(false); // Track if we've already scrolled from intro
    const isInitialMountRef = useRef(true); // Track if this is the initial mount

    // Ensure scroll container starts at the top and prevent any initial auto-scroll
    useEffect(() => {
        if (scrollContainerRef.current && isInitialMountRef.current) {
            // Reset scroll to top on initial mount and disable scroll-snap temporarily
            const container = scrollContainerRef.current;
            container.scrollTop = 0;

            // Disable scroll-snap initially to prevent automatic scrolling
            container.classList.remove('wrapped-slides__scroll-container--ready');

            // Re-enable scroll-snap after a short delay to allow initial positioning
            setTimeout(() => {
                container.classList.add('wrapped-slides__scroll-container--ready');
            }, 100);

            isInitialMountRef.current = false;
        }
    }, []);


    const slides: Slide[] = [
        {
            type: 'intro',
            content: `This week you...`,
        },
        {
            type: 'stat',
            title: 'Got',
            value: statistics.messagesReceived,
            label: 'messages',
        },
        {
            type: 'stat',
            title: 'You sent',
            value: statistics.messagesSent,
            label: 'messages',
        },
        // Only include Twitter slide if recap data is available
        ...(twitterRecap ? [{
            type: 'twitter' as const,
            content: twitterRecap,
        }] : []),
        // Only include most active day slide if data is available
        ...(allStatistics?.mostActiveDay ? [{
            type: 'mostActiveDay' as const,
            date: allStatistics.mostActiveDay.date,
            messageCount: allStatistics.mostActiveDay.messageCount,
        }] : []),
        // Only include top contact slide if data is available
        ...(breakdown?.topContacts && breakdown.topContacts.length > 0 ? [{
            type: 'topContact' as const,
            phoneNumber: breakdown.topContacts[0].phoneNumber,
            messageCount: breakdown.topContacts[0].messageCount,
            name: breakdown.topContacts[0].name,
        }] : []),
        // Add new connections slide if there are new connections this week
        ...((allStatistics?.newConnectionsThisWeek ?? 0) > 0 && newConnections && newConnections.length > 0 && user ? [{
            type: 'newConnections' as const,
            count: allStatistics?.newConnectionsThisWeek ?? 0,
            newConnections: newConnections.map(c => ({
                id: c.id,
                firstName: c.firstName,
                lastName: c.lastName,
                number: c.number,
                profilePicture: c.profilePicture,
            })),
            allConnections: (connectionsWrapped?.connections || []).map(conn => {
                const profilePic = ('profilePicture' in conn.user && typeof conn.user.profilePicture === 'string')
                    ? conn.user.profilePicture
                    : null;
                return {
                    id: conn.user.id,
                    firstName: conn.user.firstName,
                    lastName: conn.user.lastName,
                    number: conn.user.phoneNumber,
                    profilePicture: profilePic,
                };
            }),
        }] : []),
        // Add connections section if connections data is available
        ...(connectionsWrapped?.connections && connectionsWrapped.connections.length > 0 ? [
            {
                type: 'connectionsIntro' as const,
                content: "Now let's see what your connections have been up to this past week!",
            },
            // Add Twitter recap slides for connections that have Twitter recaps
            ...connectionsWrapped.connections
                .filter(conn => {
                    const recap = conn.wrapped.twitterWrapped?.weeklyRecap;
                    return recap && recap.trim().length > 0;
                })
                .map(conn => ({
                    type: 'connectionTwitter' as const,
                    userName: `${conn.user.firstName} ${conn.user.lastName}`,
                    recap: conn.wrapped.twitterWrapped?.weeklyRecap || null,
                })),
            // Add competition charts - one for total messages, one for connection count
            {
                type: 'competition' as const,
                label: `Total Messages`,
                metric: 'totalMessages' as const,
                userValue: statistics.totalMessages,
                connections: connectionsWrapped.connections.map(conn => {
                    // Convert connection user to User format for getUserDisplayName
                    const userForDisplay = {
                        id: conn.user.id,
                        first_name: conn.user.firstName,
                        last_name: conn.user.lastName,
                        number: conn.user.phoneNumber,
                        created_at: '',
                        updated_at: '',
                    };
                    return {
                        name: getUserDisplayName(userForDisplay),
                        value: conn.wrapped.statistics.totalMessages,
                    };
                }),
            },
            {
                type: 'competition' as const,
                label: `Total Connections`,
                metric: 'connectionCount' as const,
                userValue: allStatistics?.connectionCount || 0,
                connections: connectionsWrapped.connections.map(conn => {
                    // Convert connection user to User format for getUserDisplayName
                    const userForDisplay = {
                        id: conn.user.id,
                        first_name: conn.user.firstName,
                        last_name: conn.user.lastName,
                        number: conn.user.phoneNumber,
                        created_at: '',
                        updated_at: '',
                    };
                    return {
                        name: getUserDisplayName(userForDisplay),
                        value: conn.wrapped.statistics.connectionCount || 0,
                    };
                }),
            },
        ] : []),
        {
            type: 'summary',
            statistics: {
                totalMessages: statistics.totalMessages,
                messagesSent: statistics.messagesSent,
                messagesReceived: statistics.messagesReceived,
                connectionCount: allStatistics?.connectionCount,
                averageMessageLength: allStatistics?.averageMessageLength,
                longestMessage: allStatistics?.longestMessage,
                dateRange: allStatistics?.dateRange,
            },
        },
    ];

    const renderSlide = (slide: Slide, index: number) => {
        switch (slide.type) {
            case 'intro': {
                const slideIndex = index;
                return (
                    <IntroSlide
                        content={slide.content}
                        scrollContainerRef={scrollContainerRef}
                        onComplete={() => {
                            // Auto-scroll to next slide after text animation completes (only once)
                            // Add a small delay to ensure animation is fully complete
                            setTimeout(() => {
                                if (!hasScrolledRef.current && scrollContainerRef.current && slideIndex < slides.length - 1) {
                                    hasScrolledRef.current = true;
                                    const nextSlide = scrollContainerRef.current.children[slideIndex + 1] as HTMLElement;
                                    if (nextSlide) {
                                        nextSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                }
                            }, 100);
                        }}
                    />
                );
            }

            case 'stat': {
                const isFirstStat = index === 1; // First stat slide (after intro) - "Got X messages"
                const isSecondStat = index === 2; // Second stat slide - "You sent X messages"
                return (
                    <div className={`wrapped-slide wrapped-slide--stat ${isFirstStat ? 'wrapped-slide--stat-first' : ''} ${isSecondStat ? 'wrapped-slide--stat-second' : ''}`}>
                        {isFirstStat && (
                            <div className="wrapped-slide__border-lines">
                                <div className="wrapped-slide__border-line wrapped-slide__border-line--top"></div>
                                <div className="wrapped-slide__border-line wrapped-slide__border-line--right"></div>
                                <div className="wrapped-slide__border-line wrapped-slide__border-line--bottom"></div>
                                <div className="wrapped-slide__border-line wrapped-slide__border-line--left"></div>
                            </div>
                        )}
                        {isSecondStat && <Waves />}
                        <div className="wrapped-slide__stat-title">{slide.title}</div>
                        <AnimatedNumber
                            value={slide.value}
                            duration={1000}
                            className="wrapped-slide__stat-value"
                        />
                        <div className="wrapped-slide__stat-label">{slide.label}</div>
                    </div>
                );
            }

            case 'twitter':
                return (
                    <div className="wrapped-slide wrapped-slide--twitter">
                        <LoopingCurvedLines side="left" />
                        <div className="wrapped-slide__twitter-container">
                            <h2 className="wrapped-slide__title">Twitter Recap</h2>
                            <div className="wrapped-slide__twitter-content-wrapper">
                                {slide.content ? (
                                    <div className="wrapped-slide__twitter-content">
                                        {parseTwitterRecap(slide.content)}
                                    </div>
                                ) : (
                                    <p>No Twitter recap available</p>
                                )}
                            </div>
                        </div>
                        <LoopingCurvedLines side="right" />
                    </div>
                );

            case 'summary': {
                const summaryStats = slide.statistics;
                return (
                    <div className="wrapped-slide wrapped-slide--summary">
                        <h2 className="wrapped-slide__title">Your Summary</h2>
                        <div className="wrapped-slide__summary-grid">
                            <div className="wrapped-slide__summary-item">
                                <div className="wrapped-slide__summary-label">Total Messages</div>
                                <div className="wrapped-slide__summary-value">{summaryStats.totalMessages}</div>
                            </div>
                            <div className="wrapped-slide__summary-item">
                                <div className="wrapped-slide__summary-label">Messages Sent</div>
                                <div className="wrapped-slide__summary-value">{summaryStats.messagesSent}</div>
                            </div>
                            <div className="wrapped-slide__summary-item">
                                <div className="wrapped-slide__summary-label">Messages Received</div>
                                <div className="wrapped-slide__summary-value">{summaryStats.messagesReceived}</div>
                            </div>
                            {summaryStats.connectionCount !== undefined && (
                                <div className="wrapped-slide__summary-item">
                                    <div className="wrapped-slide__summary-label">Connections</div>
                                    <div className="wrapped-slide__summary-value">{summaryStats.connectionCount}</div>
                                </div>
                            )}
                            {summaryStats.averageMessageLength !== undefined && (
                                <div className="wrapped-slide__summary-item">
                                    <div className="wrapped-slide__summary-label">Avg Message Length</div>
                                    <div className="wrapped-slide__summary-value">{Math.round(summaryStats.averageMessageLength)}</div>
                                </div>
                            )}
                        </div>
                        {phoneNumber && (
                            <button
                                className="wrapped-slide__return-btn"
                                onClick={() => navigate(`/profile/${phoneNumber}`)}
                            >
                                Return to Profile
                            </button>
                        )}
                    </div>
                );
            }
            case 'mostActiveDay': {
                const dayName = new Date(slide.date).toLocaleDateString('en-US', { weekday: 'long' });
                return (
                    <MostActiveDaySlide dayName={dayName} messageCount={slide.messageCount} />
                );
            }

            case 'topContact':
                return (
                    <TopContactSlide phoneNumber={slide.phoneNumber} messageCount={slide.messageCount} name={slide.name} />
                );

            case 'newConnections':
                return (
                    <NewConnectionsSlide
                        count={slide.count}
                        newConnections={slide.newConnections}
                        allConnections={slide.allConnections}
                        user={user || { id: 0, firstName: '', lastName: '', phoneNumber: '' }}
                    />
                );

            case 'connectionsIntro': {
                const slideIndex = index;
                return (
                    <ConnectionsIntroSlide
                        content={slide.content}
                        onComplete={() => {
                            setTimeout(() => {
                                if (scrollContainerRef.current && slideIndex < slides.length - 1) {
                                    const nextSlide = scrollContainerRef.current.children[slideIndex + 1] as HTMLElement;
                                    if (nextSlide) {
                                        nextSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                }
                            }, 100);
                        }}
                    />
                );
            }

            case 'connectionTwitter':
                return (
                    <ConnectionTwitterSlide userName={slide.userName} recap={slide.recap} />
                );

            case 'competition':
                return (
                    <CompetitionChartSlide
                        label={slide.label}
                        userValue={slide.userValue}
                        connections={slide.connections}
                    />
                );

            default:
                return null;
        }
    };

    return (
        <div
            className="wrapped-slides"
            ref={containerRef}
        >
            <div className="wrapped-slides__scroll-container" ref={scrollContainerRef}>
                {slides.map((slide, index) => (
                    <div key={index} className="wrapped-slides__slide-wrapper">
                        {renderSlide(slide, index)}
                    </div>
                ))}
            </div>
        </div>
    );
}

function parseTwitterRecap(text: string): JSX.Element[] {
    // Split by paragraphs and process each
    // Remove bullet point characters (•, -, *, etc.) from the beginning of lines
    const paragraphs = text.split('\n')
        .filter(p => p.trim())
        .map(p => p.trim().replace(/^[•*-]\s*/, '')); // Remove bullet points

    return paragraphs.map((paragraph, index) => {
        let keyCounter = 0;

        // Helper function to process markdown in a text segment
        const processMarkdown = (text: string, keyPrefix: string): (string | JSX.Element)[] => {
            const result: (string | JSX.Element)[] = [];
            let lastIndex = 0;

            // Find all markdown matches (bold and italic)
            type MarkdownMatch = { start: number; end: number; content: string; type: 'bold' | 'italic' };
            const matches: MarkdownMatch[] = [];

            // Find bold matches (**text**)
            const boldRegex = /\*\*(.+?)\*\*/g;
            let boldMatch: RegExpExecArray | null;
            while ((boldMatch = boldRegex.exec(text)) !== null) {
                matches.push({
                    start: boldMatch.index,
                    end: boldMatch.index + boldMatch[0].length,
                    content: boldMatch[1],
                    type: 'bold',
                });
            }

            // Find italic matches (*text*) - but skip if it's part of a bold marker
            const italicRegex = /\*([^*]+?)\*/g;
            let italicMatch: RegExpExecArray | null;
            while ((italicMatch = italicRegex.exec(text)) !== null) {
                // Check if this is part of a bold marker (would be **)
                const isPartOfBold = text[italicMatch.index - 1] === '*' ||
                    text[italicMatch.index + italicMatch[0].length] === '*';

                if (!isPartOfBold) {
                    // Check if it overlaps with any bold match
                    const overlapsBold = matches.some(m =>
                        m.type === 'bold' &&
                        italicMatch!.index < m.end &&
                        italicMatch!.index + italicMatch![0].length > m.start
                    );

                    if (!overlapsBold) {
                        matches.push({
                            start: italicMatch.index,
                            end: italicMatch.index + italicMatch[0].length,
                            content: italicMatch[1],
                            type: 'italic',
                        });
                    }
                }
            }

            // Sort matches by position
            matches.sort((a, b) => a.start - b.start);

            // Build result array
            for (const match of matches) {
                // Add text before the match
                if (match.start > lastIndex) {
                    const beforeText = text.substring(lastIndex, match.start);
                    if (beforeText) {
                        result.push(beforeText);
                    }
                }

                // Add the formatted text
                if (match.type === 'bold') {
                    result.push(<strong key={`${keyPrefix}-bold-${keyCounter++}`}>{match.content}</strong>);
                } else {
                    result.push(<em key={`${keyPrefix}-italic-${keyCounter++}`}>{match.content}</em>);
                }

                lastIndex = match.end;
            }

            // Add remaining text
            if (lastIndex < text.length) {
                const remainingText = text.substring(lastIndex);
                if (remainingText) {
                    result.push(remainingText);
                }
            }

            return result.length > 0 ? result : [text];
        };

        // Process the entire paragraph
        const processedParts = processMarkdown(paragraph, `para-${index}`);

        return (
            <p key={index} className="wrapped-slide__paragraph">
                {processedParts}
            </p>
        );
    });
}
