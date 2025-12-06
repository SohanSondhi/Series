import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedNumber from './UI/AnimatedNumber';
import AnimatedText from './UI/AnimatedText';
import LoopingCurvedLines from './UI/LoopingCurvedLines';
import Waves from './UI/Waves';
import PulsatingNodes from './UI/PulsatingNodes';

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

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, [isVisible]);

    return (
        <div ref={containerRef} className="wrapped-slide wrapped-slide--most-active-day">
            <PulsatingNodes />
            {isVisible && (
                <>
                    <div className="wrapped-slide__most-active-day-day-text">
                        On {dayName}
                    </div>
                    {showMessage && (
                        <div className="wrapped-slide__most-active-day-message-text">
                            you sent
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
}

type Slide =
    | { type: 'intro'; content: string }
    | { type: 'stat'; title: string; value: number; label: string }
    | { type: 'twitter'; content: string | null }
    | { type: 'mostActiveDay'; date: string; messageCount: number }
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

export default function WrappedSlides({ statistics, twitterRecap, phoneNumber, allStatistics }: WrappedSlidesProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();


    const slides: Slide[] = [
        {
            type: 'intro',
            content: `This week you...`,
        },
        {
            type: 'stat',
            title: 'Got',
            value: statistics.totalMessages,
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

                // Auto-scroll from loading to intro after a brief delay
                useEffect(() => {
                    if (index === 1 && scrollContainerRef.current) {
                        const timer = setTimeout(() => {
                            const introSlide = scrollContainerRef.current?.children[1] as HTMLElement;
                            if (introSlide) {
                                introSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }, 500);
                        return () => clearTimeout(timer);
                    }
                }, [index]);

                return (
                    <div className="wrapped-slide wrapped-slide--intro">
                        <AnimatedText
                            text={slide.content}
                            className="wrapped-slide__title"
                            onComplete={() => {
                                // Auto-scroll to next slide after 1 second pause
                                if (scrollContainerRef.current && slideIndex < slides.length - 1) {
                                    const nextSlide = scrollContainerRef.current.children[slideIndex + 1] as HTMLElement;
                                    if (nextSlide) {
                                        nextSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                }
                            }}
                        />
                    </div>
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
    const paragraphs = text.split('\n').filter(p => p.trim());

    return paragraphs.map((paragraph, index) => {
        // Process bold text (**text** or **text**)
        const parts: (string | JSX.Element)[] = [];
        let lastIndex = 0;
        const boldRegex = /\*\*(.+?)\*\*/g;
        let match;

        while ((match = boldRegex.exec(paragraph)) !== null) {
            // Add text before the bold
            if (match.index > lastIndex) {
                parts.push(paragraph.substring(lastIndex, match.index));
            }
            // Add the bold text
            parts.push(<strong key={`bold-${index}-${match.index}`}>{match[1]}</strong>);
            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < paragraph.length) {
            parts.push(paragraph.substring(lastIndex));
        }

        // If no bold text was found, just return the paragraph as is
        if (parts.length === 0) {
            parts.push(paragraph);
        }

        return (
            <p key={index} className="wrapped-slide__paragraph">
                {parts}
            </p>
        );
    });
}
