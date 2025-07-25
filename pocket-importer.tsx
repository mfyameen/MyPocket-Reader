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
import {
  Upload,
  FileText,
  HighlighterIcon as HighlightIcon,
  Search,
  Calendar,
  Tag,
  ExternalLink,
  BarChart3,
  Star,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  Trash2,
  RefreshCw,
} from "lucide-react"

import Papa from "papaparse"

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
    } catch (error) {
      console.error("Failed to clear cache:", error)
    }
  }, [])

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

  // Calculate available tags based on current filters (excluding tag filters)
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
    unreadArticles: articles.filter((a) => a.status === "unread").length,
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
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">MyPocket Reader </h1>
            <p className="text-muted-foreground">{"RIP Pocket. Import and explore your articles and highlights."} </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {cacheInfo && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                <Database className="h-4 w-4" />
                <span>
                  Cached: {formatCacheDate(cacheInfo.timestamp)} ({cacheInfo.size})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCache}
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                  title="Clear cached data"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            {!showUploadSection && (
              <Button onClick={() => setShowUploadSection(true)} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            )}
          </div>
        </div>

        {/* Upload Section */}
        {showUploadSection && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Upload Articles CSV
                </CardTitle>
                <CardDescription>Upload your Pocket articles export file</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input id="csv-upload" type="file" accept=".csv" onChange={handleCSVUpload} disabled={loading} />
                  {articles.length > 0 && <p className="text-sm text-green-600">✓ Loaded {articles.length} articles</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HighlightIcon className="h-5 w-5" />
                  Upload Highlights JSON
                </CardTitle>
                <CardDescription>Upload your Pocket highlights export file (optional)</CardDescription>
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

        {/* Stats Section */}
        {articles.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Import Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalArticles}</div>
                  <div className="text-sm text-muted-foreground">Total Articles</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.readArticles}</div>
                  <div className="text-sm text-muted-foreground">Read</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.unreadArticles}</div>
                  <div className="text-sm text-muted-foreground">Unread</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.favoriteArticles}
                  </div>
                  <div className="text-sm text-muted-foreground">Favorites</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.articlesWithHighlights}
                  </div>
                  <div className="text-sm text-muted-foreground">With Highlights</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{stats.totalHighlights}</div>
                  <div className="text-sm text-muted-foreground">Total Highlights</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {articles.length > 0 && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor="search">Search Articles</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Search by title or URL..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Label htmlFor="sort-by">Sort by</Label>
                      <Select
                        value={sortBy}
                        onValueChange={(value: "default" | "newest" | "oldest" | "title-asc" | "title-desc") =>
                          setSortBy(value)
                        }
                      >
                        <SelectTrigger className="w-40">
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
                    <div className="flex flex-col sm:flex-row gap-4 pt-6">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="favorites-only"
                          checked={showFavoritesOnly}
                          onCheckedChange={(checked) => setShowFavoritesOnly(checked as boolean)}
                        />
                        <Label htmlFor="favorites-only" className="flex items-center gap-1">
                          <Star className="h-4 w-4" />
                          Favorites
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="highlights-only"
                          checked={showHighlightsOnly}
                          onCheckedChange={(checked) => setShowHighlightsOnly(checked as boolean)}
                        />
                        <Label htmlFor="highlights-only" className="flex items-center gap-1">
                          <HighlightIcon className="h-4 w-4" />
                          Highlights
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Tag Selection */}
                  <div>
                    <Label>Filter by Tags</Label>
                    <div className="mt-2">
                      {selectedTags.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm text-muted-foreground">Selected:</span>
                          {selectedTags.map((tag) => (
                            <Badge key={tag} variant="default" className="flex items-center gap-1">
                              {tag}
                              <button
                                onClick={() => handleTagToggle(tag)}
                                className="ml-1 hover:bg-white/20 dark:hover:bg-black/20 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          <Button variant="ghost" size="sm" onClick={clearSelectedTags}>
                            Clear All
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {allUniqueTags.map((tag) => {
                          const isSelected = selectedTags.includes(tag)
                          const isAvailable = availableTagsForCurrentFilters.includes(tag)
                          const isDisabled = !isSelected && !isAvailable

                          return (
                            <Badge
                              key={tag}
                              variant={isSelected ? "default" : "outline"}
                              className={`cursor-pointer transition-all ${
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
                      {selectedTags.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Disabled tags cannot be combined with your current selection
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="items-per-page">Items per page:</Label>
                      <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                        <SelectTrigger className="w-20">
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
                    <div className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredArticles.length)} of{" "}
                      {filteredArticles.length} articles
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Articles List */}
            <div className="space-y-4">
              {paginatedArticles.map((article, index) => {
                const highlights = getHighlightsForArticle(article.url)
                return (
                  <Card key={startIndex + index}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg leading-tight">{article.title}</h3>
                              {article.isFavorite && <Star className="h-5 w-5 text-yellow-500 fill-current" />}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDate(article.time_added)}
                              </div>
                              <Badge variant={article.status === "read" ? "default" : "secondary"}>
                                {article.status}
                              </Badge>
                              {highlights.length > 0 && (
                                <Badge variant="outline" className="text-purple-600 dark:text-purple-400">
                                  {highlights.length} highlight{highlights.length !== 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={article.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>

                        {article.parsedTags.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            {article.parsedTags.map((tag, tagIndex) => (
                              <Badge key={tagIndex} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {highlights.length > 0 && (
                          <div>
                            <Separator />
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm flex items-center gap-2">
                                <HighlightIcon className="h-4 w-4" />
                                Highlights
                              </h4>
                              <div className="space-y-2">
                                {highlights.map((highlight, hIndex) => (
                                  <div key={hIndex} className="bg-muted/50 p-3 rounded-md">
                                    <p className="text-sm italic mb-2">"{highlight.quote}"</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(highlight.created_at)}</p>
                                  </div>
                                ))}
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
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
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
                            className="w-10"
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
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-center text-sm text-muted-foreground mt-2">
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
        <footer className="mt-16 pt-8 border-t border-border">
          <div className="text-center text-sm text-muted-foreground">
            Made with AI by{" "}
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
