"use client"

import type React from "react"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { Upload, FileText, HighlighterIcon as HighlightIcon, Search, Calendar, Tag, ExternalLink, BarChart3, Star, X, ChevronLeft, ChevronRight, Database, Trash2, RefreshCw, Heading, Loader2, Edit3, Check, Download, ChevronDown, ChevronUp, Filter } from 'lucide-react'

import Papa from "papaparse"
import JSZip from "jszip"

interface Article {
  title: string
  url: string
  time_added: number
  tags: string
  status: string
  isFavorite: boolean
  parsedTags: string[]
}

interface Highlight {
  quote: string
  created_at: number
}

interface ArticleWithHighlights {
  url: string
  title: string
  highlights: Highlight[]
}

interface CachedData {
  articles: Article[]
  highlightData: ArticleWithHighlights[]
  timestamp: number
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100]
const CACHE_KEY = "mypocket-reader-data"

export default function PocketImporter() {
  const [articles, setArticles] = useState<Article[]>([])
  const [highlightData, setHighlightData] = useState<ArticleWithHighlights[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showHighlightsOnly, setShowHighlightsOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showUploadSection, setShowUploadSection] = useState(true)
  const [cacheInfo, setCacheInfo] = useState<{ timestamp: number; size: string } | null>(null)
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true)
  const [sortBy, setSortBy] = useState<"default" | "newest" | "oldest" | "title-asc" | "title-desc">("default")
  const [fetchingTitles, setFetchingTitles] = useState<Set<string>>(new Set())
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState("")

  // Mobile UI state
  const [showFilters, setShowFilters] = useState(false)
  const [showStats, setShowStats] = useState(false)

  // New states for inline highlight editing
  const [addingHighlight, setAddingHighlight] = useState<string | null>(null)
  const [newHighlightText, setNewHighlightText] = useState("")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Cache management functions
  const saveToCache = useCallback((articlesData: Article[], highlightsData: ArticleWithHighlights[]) => {
    try {
      const cacheData: CachedData = {
        articles: articlesData,
        highlightData: highlightsData,
        timestamp: Date.now(),
      }
      const dataString = JSON.stringify(cacheData)
      localStorage.setItem(CACHE_KEY, dataString)

      // Update cache info
      setCacheInfo({
        timestamp: cacheData.timestamp,
        size: formatBytes(new Blob([dataString]).size),
      })
    } catch (error) {
      console.error("Failed to save data to cache:", error)
    }
  }, [])

  const loadFromCache = useCallback(() => {
    try {
      const cachedDataString = localStorage.getItem(CACHE_KEY)
      if (cachedDataString) {
        const cachedData: CachedData = JSON.parse(cachedDataString)
        setArticles(cachedData.articles)
        setHighlightData(cachedData.highlightData)
        setCacheInfo({
          timestamp: cachedData.timestamp,
          size: formatBytes(new Blob([cachedDataString]).size),
        })

        // Hide upload section if we have both types of data
        if (cachedData.articles.length > 0 && cachedData.highlightData.length > 0) {
          setShowUploadSection(false)
        }

        return true
      }
    } catch (error) {
      console.error("Failed to load data from cache:", error)
    }
    return false
  }, [])

  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY)
      setArticles([])
      setHighlightData([])
      setCacheInfo(null)
      setShowUploadSection(true)
      setSearchTerm("")
      setSelectedTags([])
      setShowFavoritesOnly(false)
      setShowHighlightsOnly(false)
      setSortBy("default")
      setCurrentPage(1)
      setFetchingTitles(new Set())
      setEditingTitle(null)
      setEditTitleValue("")
      setAddingHighlight(null)
      setNewHighlightText("")
    } catch (error) {
      console.error("Failed to clear cache:", error)
    }
  }, [])

  const downloadCachedData = useCallback(async () => {
    if (articles.length === 0) return

    try {
      // Create CSV content from articles
      const csvHeaders = ["title", "url", "time_added", "tags", "status"]
      const csvRows = articles.map((article) => [
        article.title || "",
        article.url || "",
        article.time_added.toString(),
        article.tags || "",
        article.status || "unread",
      ])

      const csvContent = Papa.unparse({
        fields: csvHeaders,
        data: csvRows,
      })

      // Create JSON content from highlights (matching original format)
      const jsonContent = JSON.stringify(highlightData, null, 2)

      // Create ZIP file
      const zip = new JSZip()
      zip.file("articles.csv", csvContent)
      if (highlightData.length > 0) {
        zip.file("highlights.json", jsonContent)
      }

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `mypocket-reader-export-${new Date().toISOString().split("T")[0]}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download cached data:", error)
      alert("Failed to download data. Please try again.")
    }
  }, [articles, highlightData])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatCacheDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Load cached data on component mount
  useEffect(() => {
    setIsLoadingFromCache(true)
    const hasCache = loadFromCache()
    setIsLoadingFromCache(false)
  }, [loadFromCache])

  // Save to cache whenever articles or highlights change
  useEffect(() => {
    if (articles.length > 0 || highlightData.length > 0) {
      saveToCache(articles, highlightData)
    }
  }, [articles, highlightData, saveToCache])

  const parseTagsAndFavorites = (tagString: string) => {
    if (!tagString) return { tags: [], isFavorite: false }

    const tagParts = tagString
      .split("|")
      .map((tag) => tag.trim())
      .filter(Boolean)

    // Check for both "*" and "***" as favorite indicators
    const isFavorite = tagParts.includes("*") || tagParts.includes("***")
    const tags = tagParts.filter((tag) => tag !== "*" && tag !== "***")

    return { tags, isFavorite }
  }

  const parseCSV = useCallback((csvText: string): Article[] => {
    try {
      const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => value.trim(),
      })

      if (result.errors.length > 0) {
        console.warn("CSV parsing warnings:", result.errors)
      }

      return result.data
        .map((row: any) => {
          const { tags, isFavorite } = parseTagsAndFavorites(row.tags || "")

          return {
            title: row.title || "",
            url: row.url || "",
            time_added: Number.parseInt(row.time_added) || 0,
            tags: row.tags || "",
            status: row.status || "unread",
            isFavorite,
            parsedTags: tags,
          } as Article
        })
        .filter((article) => article.title || article.url) // Filter out completely empty rows
    } catch (error) {
      console.error("Error parsing CSV with Papa Parse:", error)
      throw new Error("Failed to parse CSV file. Please check the file format.")
    }
  }, [])

  const handleCSVUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setLoading(true)
      try {
        const text = await file.text()
        const parsedArticles = parseCSV(text)

        if (parsedArticles.length === 0) {
          throw new Error("No valid articles found in the CSV file.")
        }

        setArticles(parsedArticles)
      } catch (error) {
        console.error("Error parsing CSV:", error)
        // You could add a toast notification here to show the error to the user
        alert(`Error parsing CSV: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setLoading(false)
      }
    },
    [parseCSV],
  )

  const handleJSONUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const text = await file.text()
      const parsedHighlights = JSON.parse(text) as ArticleWithHighlights[]
      setHighlightData(parsedHighlights)
    } catch (error) {
      console.error("Error parsing JSON:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>()
    articles.forEach((article) => {
      article.parsedTags.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [articles])

  // Move this function definition up, right after the allUniqueTags useMemo
  const getHighlightsForArticle = (url: string) => {
    return highlightData.find((item) => item.url === url)?.highlights || []
  }

  // Function to fetch title from URL
  const fetchTitleFromUrl = useCallback(async (url: string) => {
    try {
      // Add URL to fetching set
      setFetchingTitles((prev) => new Set(prev).add(url))

      // Use a CORS proxy service to fetch the page
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
      const response = await fetch(proxyUrl)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const html = data.contents

      // Parse HTML to extract title
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, "text/html")
      const titleElement = doc.querySelector("title")
      const extractedTitle = titleElement?.textContent?.trim()

      if (extractedTitle && extractedTitle !== url) {
        // Update the article with the new title
        setArticles((prevArticles) =>
          prevArticles.map((article) => (article.url === url ? { ...article, title: extractedTitle } : article)),
        )
        return extractedTitle
      } else {
        throw new Error("No title found or title is same as URL")
      }
    } catch (error) {
      console.error(`Failed to fetch title for ${url}:`, error)
      // You could show a toast notification here
      return null
    } finally {
      // Remove URL from fetching set
      setFetchingTitles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(url)
        return newSet
      })
    }
  }, [])

  // Function to check if an article needs a title (title is empty or same as URL)
  const needsTitle = useCallback((article: Article) => {
    return !article.title || article.title === article.url || article.title.trim() === ""
  }, [])

  const availableTagsForCurrentFilters = useMemo(() => {
    // First, filter articles by search, favorites, and highlights (but not by tags)
    const baseFilteredArticles = articles.filter((article) => {
      const matchesSearch =
        !searchTerm ||
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.url.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesFavorites = !showFavoritesOnly || article.isFavorite
      const matchesHighlights = !showHighlightsOnly || getHighlightsForArticle(article.url).length > 0

      return matchesSearch && matchesFavorites && matchesHighlights
    })

    // If no tags are selected, all tags from base filtered articles are available
    if (selectedTags.length === 0) {
      const availableTags = new Set<string>()
      baseFilteredArticles.forEach((article) => {
        article.parsedTags.forEach((tag) => availableTags.add(tag))
      })
      return Array.from(availableTags)
    }

    // If tags are selected, find which additional tags can be combined with current selection
    const articlesMatchingCurrentTags = baseFilteredArticles.filter((article) =>
      selectedTags.every((tag) => article.parsedTags.includes(tag)),
    )

    const availableTags = new Set<string>()
    articlesMatchingCurrentTags.forEach((article) => {
      article.parsedTags.forEach((tag) => availableTags.add(tag))
    })

    return Array.from(availableTags)
  }, [articles, searchTerm, showFavoritesOnly, showHighlightsOnly, selectedTags, highlightData])

  // Then the filteredArticles useMemo can safely use getHighlightsForArticle
  const filteredArticles = useMemo(() => {
    const filtered = articles.filter((article) => {
      const matchesSearch =
        !searchTerm ||
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.url.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesTags = selectedTags.length === 0 || selectedTags.every((tag) => article.parsedTags.includes(tag))

      const matchesFavorites = !showFavoritesOnly || article.isFavorite

      const matchesHighlights = !showHighlightsOnly || getHighlightsForArticle(article.url).length > 0

      return matchesSearch && matchesTags && matchesFavorites && matchesHighlights
    })

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "default":
          return 0 // No sorting - maintain original order
        case "newest":
          return b.time_added - a.time_added
        case "oldest":
          return a.time_added - b.time_added
        case "title-asc":
          return a.title.localeCompare(b.title)
        case "title-desc":
          return b.title.localeCompare(a.title)
        default:
          return 0
      }
    })

    return filtered
  }, [articles, searchTerm, selectedTags, showFavoritesOnly, showHighlightsOnly, highlightData, sortBy])

  const startEditingTitle = useCallback((url: string, currentTitle: string) => {
    setEditingTitle(url)
    setEditTitleValue(currentTitle || url)
  }, [])

  const saveEditedTitle = useCallback(
    (url: string) => {
      if (editTitleValue.trim()) {
        setArticles((prevArticles) =>
          prevArticles.map((article) => (article.url === url ? { ...article, title: editTitleValue.trim() } : article)),
        )
      }
      setEditingTitle(null)
      setEditTitleValue("")
    },
    [editTitleValue],
  )

  const cancelEditingTitle = useCallback(() => {
    setEditingTitle(null)
    setEditTitleValue("")
  }, [])

  // New function to start adding a new highlight
  const startAddingHighlight = useCallback((url: string) => {
    setAddingHighlight(url)
    setNewHighlightText("")
  }, [])

  // New function to save the new highlight
  const saveNewHighlight = useCallback(
    (url: string) => {
      if (newHighlightText.trim()) {
        const newHighlight: Highlight = {
          quote: newHighlightText.trim(),
          created_at: Math.floor(Date.now() / 1000), // Unix timestamp
        }

        setHighlightData((prevHighlights) => {
          const existingArticle = prevHighlights.find((item) => item.url === url)

          if (existingArticle) {
            // Add to existing article's highlights
            return prevHighlights.map((item) =>
              item.url === url ? { ...item, highlights: [...item.highlights, newHighlight] } : item,
            )
          } else {
            // Create new article with highlight
            const article = articles.find((a) => a.url === url)
            return [
              ...prevHighlights,
              {
                url,
                title: article?.title || url,
                highlights: [newHighlight],
              },
            ]
          }
        })
      }
      setAddingHighlight(null)
      setNewHighlightText("")
    },
    [newHighlightText, articles],
  )

  // New function to cancel adding a highlight
  const cancelAddingHighlight = useCallback(() => {
    setAddingHighlight(null)
    setNewHighlightText("")
  }, [])

  // Pagination calculations
  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedTags, showFavoritesOnly, showHighlightsOnly, itemsPerPage, sortBy])

  // Hide upload section when both files are uploaded
  useEffect(() => {
    if (articles.length > 0 && highlightData.length > 0) {
      setShowUploadSection(false)
    }
  }, [articles.length, highlightData.length])

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const clearSelectedTags = () => {
    setSelectedTags([])
  }

  const stats = {
    totalArticles: articles.length,
    readArticles: articles.filter((a) => a.status === "read").length,
    unreadArticles: articles.filter((a) => a.status !== "read").length,
    favoriteArticles: articles.filter((a) => a.isFavorite).length,
    articlesWithHighlights: highlightData.length,
    totalHighlights: highlightData.reduce((sum, item) => sum + item.highlights.length, 0),
  }

  if (isLoadingFromCache) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 sm:py-8 px-4">
        <div className="mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold mb-2">MyPocket Reader</h1>
            <p className="text-muted-foreground text-sm lg:text-base">
              {"RIP Pocket. Import and explore your articles and highlights."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            {cacheInfo && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-muted/50 px-2 sm:px-3 py-2 rounded-md">
                <Database className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">
                  Cached: {formatCacheDate(cacheInfo.timestamp)} ({cacheInfo.size})
                </span>
                <span className="sm:hidden">
                  {cacheInfo.size}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCache}
                  className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                  title="Clear cached data"
                >
                  <Trash2 className="h-2 w-2 sm:h-3 sm:w-3" />
                </Button>
              </div>
            )}
            {!showUploadSection && (
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setShowUploadSection(true)} variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Upload</span>
                </Button>
                {articles.length > 0 && (
                  <Button onClick={downloadCachedData} variant="outline" size="sm" className="flex-1 sm:flex-none">
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="text-xs sm:text-sm">Export</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload Section */}
        {showUploadSection && (
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Upload Articles CSV
                </CardTitle>
                <CardDescription className="text-sm">Upload your Pocket articles export file</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input id="csv-upload" type="file" accept=".csv" onChange={handleCSVUpload} disabled={loading} />
                  {articles.length > 0 && <p className="text-sm text-green-600">✓ Loaded {articles.length} articles</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <HighlightIcon className="h-5 w-5" />
                  Upload Highlights JSON
                </CardTitle>
                <CardDescription className="text-sm">Upload your Pocket highlights export file (optional)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input id="json-upload" type="file" accept=".json" onChange={handleJSONUpload} disabled={loading} />
                  {highlightData.length > 0 && (
                    <p className="text-sm text-green-600">✓ Loaded highlights for {highlightData.length} articles</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Section - Collapsible on Mobile */}
        {articles.length > 0 && (
          <Card className="mb-6 sm:mb-8">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5" />
                  Import Statistics
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStats(!showStats)}
                  className="sm:hidden"
                >
                  {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`${showStats ? 'block' : 'hidden sm:block'}`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="text-center p-3 sm:p-0">
                  <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalArticles}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 sm:p-0">
                  <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.readArticles}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Read</div>
                </div>
                <div className="text-center p-3 sm:p-0">
                  <div className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.unreadArticles}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Unread</div>
                </div>
                <div className="text-center p-3 sm:p-0">
                  <div className="text-lg sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.favoriteArticles}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Favorites</div>
                </div>
                <div className="text-center p-3 sm:p-0">
                  <div className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.articlesWithHighlights}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">With Highlights</div>
                </div>
                <div className="text-center p-3 sm:p-0">
                  <div className="text-lg sm:text-2xl font-bold text-pink-600 dark:text-pink-400">{stats.totalHighlights}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Total Highlights</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {articles.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <div className="space-y-4">
                  {/* Mobile filter toggle */}
                  <div className="lg:hidden">
                    <Button
                      variant="outline"
                      onClick={() => setShowFilters(!showFilters)}
                      className="w-full mb-4 justify-center"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      {showFilters ? 'Hide Filters' : 'Show Filters'}
                      {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
                    </Button>
                  </div>

                  <div className={`space-y-4 ${showFilters ? 'block' : 'hidden lg:block'}`}>
                    {/* Search and Sort Row */}
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1">
                        <Label htmlFor="search" className="text-sm font-medium mb-2 block">Search Articles</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="search"
                            placeholder="Search by title or URL..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-11 sm:h-10"
                          />
                        </div>
                      </div>
                      <div className="w-full lg:w-48">
                        <Label htmlFor="sort-by" className="text-sm font-medium mb-2 block">Sort by</Label>
                        <Select
                          value={sortBy}
                          onValueChange={(value: "default" | "newest" | "oldest" | "title-asc" | "title-desc") =>
                            setSortBy(value)
                          }
                        >
                          <SelectTrigger className="h-11 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default Order</SelectItem>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="title-asc">Title A-Z</SelectItem>
                            <SelectItem value="title-desc">Title Z-A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Quick Filters */}
                    <div className="bg-muted/30 p-4 rounded-lg">
                      <Label className="text-sm font-medium mb-3 block">Quick Filters</Label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="favorites-only"
                            checked={showFavoritesOnly}
                            onCheckedChange={(checked) => setShowFavoritesOnly(checked as boolean)}
                          />
                          <Label htmlFor="favorites-only" className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                            <Star className="h-4 w-4 text-yellow-500" />
                            Show Favorites Only
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="highlights-only"
                            checked={showHighlightsOnly}
                            onCheckedChange={(checked) => setShowHighlightsOnly(checked as boolean)}
                          />
                          <Label htmlFor="highlights-only" className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                            <HighlightIcon className="h-4 w-4 text-purple-500" />
                            Show With Highlights Only
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Tag Selection */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Filter by Tags</Label>
                      <div className="space-y-3">
                        {selectedTags.length > 0 && (
                          <div className="bg-primary/5 p-3 rounded-lg">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-muted-foreground">Selected Tags:</span>
                              {selectedTags.map((tag) => (
                                <Badge key={tag} variant="default" className="flex items-center gap-1 text-xs">
                                  {tag}
                                  <button
                                    onClick={() => handleTagToggle(tag)}
                                    className="ml-1 hover:bg-white/20 dark:hover:bg-black/20 rounded-full p-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                            <Button variant="ghost" size="sm" onClick={clearSelectedTags} className="text-xs h-7">
                              Clear All Tags
                            </Button>
                          </div>
                        )}
                        <div className="bg-muted/30 p-3 rounded-lg max-h-32 overflow-y-auto">
                          <div className="flex flex-wrap gap-2">
                            {allUniqueTags.map((tag) => {
                              const isSelected = selectedTags.includes(tag)
                              const isAvailable = availableTagsForCurrentFilters.includes(tag)
                              const isDisabled = !isSelected && !isAvailable

                              return (
                                <Badge
                                  key={tag}
                                  variant={isSelected ? "default" : "outline"}
                                  className={`cursor-pointer transition-all text-xs ${
                                    isDisabled ? "opacity-40 cursor-not-allowed hover:opacity-40" : "hover:bg-primary/80"
                                  }`}
                                  onClick={() => !isDisabled && handleTagToggle(tag)}
                                  title={
                                    isDisabled
                                      ? "This tag cannot be combined with current filters"
                                      : isSelected
                                        ? "Click to remove this tag filter"
                                        : "Click to add this tag filter"
                                  }
                                >
                                  {tag}
                                </Badge>
                              )
                            })}
                          </div>
                          {allUniqueTags.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">No tags available</p>
                          )}
                        </div>
                        {selectedTags.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Disabled tags cannot be combined with your current selection
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="items-per-page" className="text-xs font-medium">Items per page:</Label>
                        <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                          <SelectTrigger className="w-20 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option.toString()}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-xs text-muted-foreground text-center sm:text-right">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredArticles.length)} of{" "}
                        {filteredArticles.length} articles
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Articles List */}
            <div className="space-y-3 sm:space-y-4">
              {paginatedArticles.map((article, index) => {
                const highlights = getHighlightsForArticle(article.url)
                const waybackMachineUrl = `https://web.archive.org/web/${article.url}`
                const isFetchingTitle = fetchingTitles.has(article.url)
                const articleNeedsTitle = needsTitle(article)

                return (
                  <Card key={startIndex + index} className="group">
                    <CardContent className="pt-3 pb-3 sm:pt-6 sm:pb-6">
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-start justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 mb-1 sm:mb-2">
                              {editingTitle === article.url ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={editTitleValue}
                                    onChange={(e) => setEditTitleValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        saveEditedTitle(article.url)
                                      } else if (e.key === "Escape") {
                                        cancelEditingTitle()
                                      }
                                    }}
                                    className="flex-1 text-sm sm:text-base"
                                    autoFocus
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => saveEditedTitle(article.url)}
                                    className="h-8 w-8 p-0 flex-shrink-0"
                                    title="Save title"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={cancelEditingTitle}
                                    className="h-8 w-8 p-0 flex-shrink-0"
                                    title="Cancel editing"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-sm sm:text-lg leading-tight hover:text-primary transition-colors cursor-pointer flex-1 min-w-0 break-words"
                                    title="Click to open article in new tab"
                                  >
                                    {article.title || article.url}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditingTitle(article.url, article.title)}
                                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                    title="Edit title"
                                  >
                                    <Edit3 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                </>
                              )}
                              {article.isFavorite && <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 fill-current flex-shrink-0" />}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span>{formatDate(article.time_added)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={article.status === "read" ? "default" : "secondary"} className="text-xs h-5">
                                  {article.status}
                                </Badge>
                                {highlights.length > 0 && (
                                  <Badge variant="outline" className="text-purple-600 dark:text-purple-400 text-xs h-5">
                                    {highlights.length} highlight{highlights.length !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                            <Button variant="outline" size="sm" className="h-8 w-8 sm:h-8 sm:w-8 p-0 text-muted-foreground hover:text-foreground" asChild>
                              <a
                                href={waybackMachineUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open article on Wayback Machine"
                              >
                                <img
                                  src="/internet-archive.svg"
                                  alt="Internet Archive Wayback Machine"
                                  className="h-4 w-4"
                                />
                              </a>
                            </Button>
                          </div>
                        </div>

                        {/* Tags and Fetch Title Button Row */}
                        <div className="flex items-center justify-between gap-2">
                          {/* Tags Section */}
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap flex-1 min-w-0">
                            {article.parsedTags.length > 0 && (
                              <>
                                <Tag className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                {article.parsedTags.map((tag, tagIndex) => (
                                  <Badge key={tagIndex} variant="outline" className="text-xs h-5">
                                    {tag}
                                  </Badge>
                                ))}
                              </>
                            )}
                          </div>

                          {/* Fetch Title Button */}
                          {articleNeedsTitle && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchTitleFromUrl(article.url)}
                              disabled={isFetchingTitle}
                              className="ml-2 h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                              title={isFetchingTitle ? "Fetching title..." : "Fetch title from webpage"}
                            >
                              {isFetchingTitle ? (
                                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                              ) : (
                                <Heading className="h-3 w-3 sm:h-4 sm:w-4" />
                              )}
                            </Button>
                          )}
                        </div>

                        {/* Add Highlight Button for articles without highlights */}
                        {highlights.length === 0 && addingHighlight !== article.url && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startAddingHighlight(article.url)}
                              className="w-full h-8 sm:h-8 text-xs sm:text-sm text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60"
                              title="Add your first highlight for this article"
                            >
                              <HighlightIcon className="h-3 w-3 mr-2" />
                              Add Highlight
                            </Button>
                          </div>
                        )}

                        {(highlights.length > 0 || addingHighlight === article.url) && (
                          <div>
                            <Separator />
                            <div className="space-y-2 pt-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm flex items-center gap-2">
                                  <HighlightIcon className="h-4 w-4" />
                                  Highlights
                                </h4>
                                {addingHighlight !== article.url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startAddingHighlight(article.url)}
                                    className="h-7 px-2 text-xs"
                                    title="Add new highlight"
                                  >
                                    <HighlightIcon className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-2">
                                {highlights.map((highlight, hIndex) => (
                                  <div key={hIndex} className="bg-muted/50 p-2 sm:p-3 rounded-md">
                                    <p className="text-xs sm:text-sm italic mb-1 sm:mb-2 break-words">"{highlight.quote}"</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(highlight.created_at)}</p>
                                  </div>
                                ))}

                                {/* New Highlight Input */}
                                {addingHighlight === article.url && (
                                  <div className="bg-muted/30 p-2 sm:p-3 rounded-md border-2 border-dashed border-muted-foreground/30">
                                    <textarea
                                      value={newHighlightText}
                                      onChange={(e) => setNewHighlightText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && e.ctrlKey) {
                                          saveNewHighlight(article.url)
                                        } else if (e.key === "Escape") {
                                          cancelAddingHighlight()
                                        }
                                      }}
                                      placeholder="Enter your highlight text..."
                                      className="w-full min-h-[50px] sm:min-h-[60px] p-2 text-xs sm:text-sm bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                                      autoFocus
                                    />
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2 gap-2">
                                      <p className="text-xs text-muted-foreground">
                                        Press Ctrl+Enter to save, Esc to cancel
                                      </p>
                                      <div className="flex gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => saveNewHighlight(article.url)}
                                          disabled={!newHighlightText.trim()}
                                          className="h-6 px-2 text-xs"
                                          title="Save highlight"
                                        >
                                          <Check className="h-3 w-3 mr-1" />
                                          Save
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={cancelAddingHighlight}
                                          className="h-6 px-2 text-xs"
                                          title="Cancel"
                                        >
                                          <X className="h-3 w-3 mr-1" />
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Pagination Navigation */}
            {totalPages > 1 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="h-9 sm:h-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">Previous</span>
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-9 h-9 sm:w-10 sm:h-8 text-sm"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="h-9 sm:h-8"
                    >
                      <span className="hidden sm:inline mr-1">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-center text-xs sm:text-sm text-muted-foreground mt-2">
                    Page {currentPage} of {totalPages}
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredArticles.length === 0 && articles.length > 0 && (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No articles match your search criteria.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {articles.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Get Started</h3>
              <p className="text-muted-foreground">
                Upload your Pocket export files to begin exploring your articles and highlights.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-border">
          <div className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} MyPocket Reader. All rights reserved.
            <br />
            Open source and available on{" "}
            <a
              href="https://github.com/mfyameen/MyPocket-Reader"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            . Made with AI by{" "}
            <a
              href="https://github.com/mfyameen"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              @mfyameen
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}
