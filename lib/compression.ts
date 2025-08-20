import LZString from 'lz-string';

// Compression settings
const COMPRESSION_KEY_SUFFIX = '_compressed';
const COMPRESSION_VERSION = 'v1';

interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

interface CompressionMetadata {
  version: string;
  timestamp: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compresses a JSON string using LZ-string
 * Returns both the compressed data and metadata about the compression
 */
export function compressData(jsonString: string): CompressionResult {
  const originalSize = new Blob([jsonString]).size;
  
  try {
    // Use LZ-string compression optimized for localStorage
    const compressed = LZString.compressToUTF16(jsonString);
    const compressedSize = new Blob([compressed]).size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
    
    return {
      compressed,
      originalSize,
      compressedSize,
      compressionRatio
    };
  } catch (error) {
    console.error('🗜️ Compression failed, falling back to uncompressed data:', error);
    // Fallback: return original data
    return {
      compressed: jsonString,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0
    };
  }
}

/**
 * Decompresses data that was compressed with compressData
 * Handles both compressed and uncompressed data for backward compatibility
 */
export function decompressData(data: string): string {
  try {
    // Try to decompress - if it fails, assume it's uncompressed data
    const decompressed = LZString.decompressFromUTF16(data);
    
    // If decompression returns null or empty string, return original data
    if (decompressed === null || decompressed === '') {
      return data;
    }
    
    return decompressed;
  } catch (error) {
    console.warn('🗜️ Decompression failed, assuming uncompressed data:', error);
    // Fallback: return original data (might be uncompressed)
    return data;
  }
}

/**
 * Saves data to localStorage with compression
 * Includes metadata about the compression for debugging and UI display
 */
export function saveCompressedToLocalStorage(
  key: string, 
  data: any, 
  useCompression: boolean = true
): CompressionMetadata {
  const jsonString = JSON.stringify(data);
  
  if (useCompression) {
    const compressionResult = compressData(jsonString);
    
    // Create metadata
    const metadata: CompressionMetadata = {
      version: COMPRESSION_VERSION,
      timestamp: Date.now(),
      originalSize: compressionResult.originalSize,
      compressedSize: compressionResult.compressedSize,
      compressionRatio: compressionResult.compressionRatio
    };
    
    // Save compressed data with metadata
    const compressedPayload = {
      compressed: true,
      version: COMPRESSION_VERSION,
      data: compressionResult.compressed,
      metadata
    };
    
    localStorage.setItem(key, JSON.stringify(compressedPayload));
    
    console.log('💾 Data saved with compression:', {
      key,
      originalSize: formatBytes(metadata.originalSize),
      compressedSize: formatBytes(metadata.compressedSize),
      savings: formatBytes(metadata.originalSize - metadata.compressedSize),
      compressionRatio: metadata.compressionRatio.toFixed(1) + '%'
    });
    
    return metadata;
  } else {
    // Save uncompressed data
    localStorage.setItem(key, jsonString);
    
    const metadata: CompressionMetadata = {
      version: COMPRESSION_VERSION,
      timestamp: Date.now(),
      originalSize: new Blob([jsonString]).size,
      compressedSize: new Blob([jsonString]).size,
      compressionRatio: 0
    };
    
    console.log('💾 Data saved without compression:', {
      key,
      size: formatBytes(metadata.originalSize)
    });
    
    return metadata;
  }
}

/**
 * Loads data from localStorage with automatic decompression
 * Handles both compressed and legacy uncompressed data
 */
export function loadCompressedFromLocalStorage(key: string): {
  data: any;
  metadata: CompressionMetadata | null;
} {
  try {
    const storedData = localStorage.getItem(key);
    
    if (!storedData) {
      return { data: null, metadata: null };
    }
    
    try {
      const parsed = JSON.parse(storedData);
      
      // Check if it's compressed data with our format
      if (parsed.compressed && parsed.version && parsed.data) {
        const decompressedString = decompressData(parsed.data);
        const data = JSON.parse(decompressedString);
        
        console.log('📂 Loaded compressed data:', {
          key,
          version: parsed.version,
          originalSize: formatBytes(parsed.metadata.originalSize),
          compressedSize: formatBytes(parsed.metadata.compressedSize),
          savings: formatBytes(parsed.metadata.originalSize - parsed.metadata.compressedSize),
          compressionRatio: parsed.metadata.compressionRatio.toFixed(1) + '%'
        });
        
        return { data, metadata: parsed.metadata };
      } else {
        // Legacy uncompressed data
        console.log('📂 Loaded legacy uncompressed data:', { key });
        
        const metadata: CompressionMetadata = {
          version: 'legacy',
          timestamp: Date.now(),
          originalSize: new Blob([storedData]).size,
          compressedSize: new Blob([storedData]).size,
          compressionRatio: 0
        };
        
        return { data: parsed, metadata };
      }
    } catch (parseError) {
      // If JSON parsing fails, might be old raw string data
      console.warn('📂 Failed to parse stored data, assuming legacy format:', parseError);
      
      const metadata: CompressionMetadata = {
        version: 'legacy-raw',
        timestamp: Date.now(),
        originalSize: new Blob([storedData]).size,
        compressedSize: new Blob([storedData]).size,
        compressionRatio: 0
      };
      
      return { data: storedData, metadata };
    }
  } catch (error) {
    console.error('📂 Failed to load data from localStorage:', error);
    return { data: null, metadata: null };
  }
}

/**
 * Gets compression statistics for stored data without loading the full dataset
 */
export function getCompressionStats(key: string): CompressionMetadata | null {
  try {
    const storedData = localStorage.getItem(key);
    if (!storedData) return null;
    
    const parsed = JSON.parse(storedData);
    
    if (parsed.compressed && parsed.metadata) {
      return parsed.metadata;
    } else {
      // Legacy uncompressed data
      return {
        version: 'legacy',
        timestamp: Date.now(),
        originalSize: new Blob([storedData]).size,
        compressedSize: new Blob([storedData]).size,
        compressionRatio: 0
      };
    }
  } catch (error) {
    console.error('📊 Failed to get compression stats:', error);
    return null;
  }
}

/**
 * Migrates legacy uncompressed data to compressed format
 */
export function migrateToCompressed(key: string): boolean {
  try {
    const { data, metadata } = loadCompressedFromLocalStorage(key);
    
    if (!data || !metadata) return false;
    
    // If already compressed, no migration needed
    if (metadata.version !== 'legacy' && metadata.version !== 'legacy-raw') {
      return true;
    }
    
    // Migrate to compressed format
    console.log('🔄 Migrating data to compressed format:', key);
    const newMetadata = saveCompressedToLocalStorage(key, data, true);
    
    console.log('✅ Migration completed:', {
      key,
      oldSize: formatBytes(metadata.originalSize),
      newSize: formatBytes(newMetadata.compressedSize),
      savings: formatBytes(metadata.originalSize - newMetadata.compressedSize),
      compressionRatio: newMetadata.compressionRatio.toFixed(1) + '%'
    });
    
    return true;
  } catch (error) {
    console.error('🔄 Migration failed:', error);
    return false;
  }
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unit = (i >= 0 && i < sizes.length) ? sizes[i] : sizes[0];
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + unit;
}
