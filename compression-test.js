const zlib = require('zlib');
const fs = require('fs');

// Simulate typical MyPocket Reader data structure
function generateSampleData() {
  const articles = [];
  const highlights = [];
  
  // Generate sample articles (typical for 1.2MB file - roughly 2000-5000 articles)
  for (let i = 0; i < 3000; i++) {
    articles.push({
      title: `Sample Article ${i + 1}: How to Build Better Web Applications with Modern JavaScript Frameworks`,
      url: `https://example.com/article-${i + 1}/${Math.random().toString(36).substring(7)}`,
      time_added: 1640995200 + (i * 86400), // Sequential dates
      tags: i % 5 === 0 ? "javascript|web-development|tutorial" : i % 3 === 0 ? "programming" : "",
      status: i % 4 === 0 ? "read" : "unread",
      isFavorite: i % 10 === 0,
      parsedTags: i % 5 === 0 ? ["javascript", "web-development", "tutorial"] : i % 3 === 0 ? ["programming"] : []
    });
  }
  
  // Generate sample highlights (about 30% of articles have highlights)
  for (let i = 0; i < 900; i++) {
    const articleIndex = Math.floor(Math.random() * 3000);
    const numHighlights = Math.floor(Math.random() * 3) + 1;
    const articleHighlights = [];
    
    for (let j = 0; j < numHighlights; j++) {
      articleHighlights.push({
        quote: `This is a highlighted quote from article ${articleIndex + 1}. It contains important information that the user wanted to save for later reference. The quote might be several sentences long and contain technical details or key insights.`,
        created_at: 1640995200 + (i * 3600) + (j * 300) // Different timestamps
      });
    }
    
    highlights.push({
      url: `https://example.com/article-${articleIndex + 1}/${Math.random().toString(36).substring(7)}`,
      title: `Sample Article ${articleIndex + 1}: How to Build Better Web Applications with Modern JavaScript Frameworks`,
      highlights: articleHighlights
    });
  }
  
  return {
    articles,
    highlightData: highlights,
    timestamp: Date.now()
  };
}

function testCompression() {
  console.log('🧪 Testing localStorage compression for MyPocket Reader...\n');
  
  const sampleData = generateSampleData();
  const jsonString = JSON.stringify(sampleData);
  
  // Original size
  const originalSize = Buffer.byteLength(jsonString, 'utf8');
  console.log(`📊 Sample data statistics:`);
  console.log(`   Articles: ${sampleData.articles.length.toLocaleString()}`);
  console.log(`   Highlights: ${sampleData.highlightData.length.toLocaleString()} articles with highlights`);
  console.log(`   Total highlight quotes: ${sampleData.highlightData.reduce((sum, item) => sum + item.highlights.length, 0).toLocaleString()}`);
  console.log(`   Original JSON size: ${formatBytes(originalSize)}\n`);
  
  // Test different compression levels
  const compressionResults = [];
  
  // gzip compression (most common)
  const gzipCompressed = zlib.gzipSync(jsonString);
  const gzipRatio = (1 - gzipCompressed.length / originalSize) * 100;
  compressionResults.push({
    method: 'gzip',
    size: gzipCompressed.length,
    ratio: gzipRatio,
    savings: originalSize - gzipCompressed.length
  });
  
  // deflate compression
  const deflateCompressed = zlib.deflateSync(jsonString);
  const deflateRatio = (1 - deflateCompressed.length / originalSize) * 100;
  compressionResults.push({
    method: 'deflate',
    size: deflateCompressed.length,
    ratio: deflateRatio,
    savings: originalSize - deflateCompressed.length
  });
  
  // brotli compression (newer, better compression)
  const brotliCompressed = zlib.brotliCompressSync(jsonString);
  const brotliRatio = (1 - brotliCompressed.length / originalSize) * 100;
  compressionResults.push({
    method: 'brotli',
    size: brotliCompressed.length,
    ratio: brotliRatio,
    savings: originalSize - brotliCompressed.length
  });
  
  console.log('📈 Compression Results:');
  console.log('========================\n');
  
  compressionResults.forEach(result => {
    console.log(`${result.method.toUpperCase()} Compression:`);
    console.log(`   Compressed size: ${formatBytes(result.size)}`);
    console.log(`   Compression ratio: ${result.ratio.toFixed(1)}%`);
    console.log(`   Storage savings: ${formatBytes(result.savings)}`);
    console.log('');
  });
  
  // Scale up to 1.2MB
  const scaleFactor = (1.2 * 1024 * 1024) / originalSize;
  console.log(`🔍 Scaled to 1.2MB (${scaleFactor.toFixed(1)}x current sample):`);
  console.log('=====================================================\n');
  
  compressionResults.forEach(result => {
    const scaledOriginal = 1.2 * 1024 * 1024;
    const scaledCompressed = result.size * scaleFactor;
    const scaledSavings = scaledOriginal - scaledCompressed;
    const scaledRatio = (scaledSavings / scaledOriginal) * 100;
    
    console.log(`${result.method.toUpperCase()} for 1.2MB file:`);
    console.log(`   Compressed size: ${formatBytes(scaledCompressed)}`);
    console.log(`   Storage savings: ${formatBytes(scaledSavings)}`);
    console.log(`   Compression ratio: ${scaledRatio.toFixed(1)}%`);
    console.log('');
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

testCompression();
