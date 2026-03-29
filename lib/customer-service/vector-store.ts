import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'data')
const VECTOR_FILE = join(DATA_DIR, 'vector-store.json')

export interface VectorEntry {
  id: string
  document: string
  embedding: number[]
  metadata: Record<string, string>
}

export interface VectorResult {
  id: string
  score: number
  metadata: Record<string, string>
  document: string
}

type EmbedFn = (text: string) => Promise<number[]>

/**
 * Local vector store with HuggingFace transformers embeddings.
 * Stores vectors as JSON on disk, cosine similarity in memory.
 * For 100-1000 rules this is fast (<10ms query).
 * Interface compatible with ChromaDB — can swap to server-based ChromaDB later.
 */
export class VectorStore {
  private entries: Map<string, VectorEntry> = new Map()
  private embedFn: EmbedFn | null = null
  private collectionName: string
  private filePath: string
  private initialized = false

  constructor(collectionName: string = 'knowledge-rules') {
    this.collectionName = collectionName
    this.filePath = join(DATA_DIR, `vectors-${collectionName}.json`)
  }

  async init() {
    if (this.initialized) return

    // Load from disk
    if (existsSync(this.filePath)) {
      try {
        const data = JSON.parse(readFileSync(this.filePath, 'utf-8'))
        for (const entry of data) {
          this.entries.set(entry.id, entry)
        }
      } catch { /* corrupted file, start fresh */ }
    }

    // Lazy-init embedding model
    if (!this.embedFn) {
      this.embedFn = await createEmbedFunction()
    }

    this.initialized = true
  }

  private async ensureInit() {
    if (!this.initialized) await this.init()
  }

  private persist() {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
    const data = Array.from(this.entries.values())
    writeFileSync(this.filePath, JSON.stringify(data), 'utf-8')
  }

  async upsert(
    id: string,
    condition: string,
    content: string,
    metadata: Record<string, string> = {}
  ) {
    await this.ensureInit()
    const document = `${condition} ${content}`
    const embedding = await this.embedFn!(document)
    this.entries.set(id, { id, document, embedding, metadata })
    this.persist()
  }

  async query(text: string, topK: number = 5): Promise<VectorResult[]> {
    await this.ensureInit()
    if (this.entries.size === 0) return []

    const queryEmbedding = await this.embedFn!(text)

    // Compute cosine similarity for all entries
    const scored: VectorResult[] = []
    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(queryEmbedding, entry.embedding)
      scored.push({
        id: entry.id,
        score,
        metadata: entry.metadata,
        document: entry.document,
      })
    }

    // Sort by score descending, return top K
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  async remove(id: string) {
    await this.ensureInit()
    this.entries.delete(id)
    this.persist()
  }

  async reset() {
    this.entries.clear()
    if (existsSync(this.filePath)) {
      try { writeFileSync(this.filePath, '[]', 'utf-8') } catch { /* ignore */ }
    }
    this.initialized = false
  }

  get size() {
    return this.entries.size
  }
}

/**
 * Create embedding function using HuggingFace transformers (local onnxruntime).
 * Model: all-MiniLM-L6-v2 (384 dims, fast, good for multilingual)
 */
async function createEmbedFunction(): Promise<EmbedFn> {
  const { pipeline } = await import('@huggingface/transformers')
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')

  return async (text: string): Promise<number[]> => {
    const result = await extractor(text, { pooling: 'mean', normalize: true })
    return Array.from(result.data as Float32Array)
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// Singleton
let _store: VectorStore | null = null
export function getVectorStore(): VectorStore {
  if (!_store) {
    _store = new VectorStore()
  }
  return _store
}
