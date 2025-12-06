// Main entry point for Kafka ingestor
import { startKafkaIngestor } from './ingestor.js';

// Start the ingestor when this file is executed directly
startKafkaIngestor().catch((error) => {
    console.error('Failed to start Kafka ingestor:', error);
    process.exit(1);
});

export { startKafkaIngestor } from './ingestor.js';
export { shutdownKafkaIngestor } from './ingestor.js';
