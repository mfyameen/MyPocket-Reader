"use client"

import type React from "react"

import { useState, useCallback, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { useTheme } from "next-themes"
import {
  Upload,
  FileText,
  HighlighterIcon as HighlightIcon,
  Search,
  Calendar,
  Tag,
  BarChart3,
  Star,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  Trash2,
  RefreshCw,
  Heading,
  Loader2,
  Edit3,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  Filter,
  Plus,
} from "lucide-react"

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
  const { theme } = useTheme()
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
  const [showFilters, setShowFilters] = useState(true)
  const [showStats, setShowStats] = useState(true)

  // New states for inline highlight editing
  const [addingHighlight, setAddingHighlight] = useState<string | null>(null)
  const [newHighlightText, setNewHighlightText] = useState("")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // New state for ZIP upload loading
  const [zipLoading, setZipLoading] = useState(false)

  // New state for upload mode
  const [uploadMode, setUploadMode] = useState<"zip" | "individual">("zip")

  const [showReadOnly, setShowReadOnly] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  // New states for adding articles
  const [showAddArticle, setShowAddArticle] = useState(false)
  const [newArticleUrl, setNewArticleUrl] = useState("")
  const [newArticleTitle, setNewArticleTitle] = useState("")
  const [newArticleTags, setNewArticleTags] = useState("")
  const [newArticleIsFavorite, setNewArticleIsFavorite] = useState(false)
  const [addingArticle, setAddingArticle] = useState(false)

  // New state for cache menu visibility
  const [showCacheMenu, setShowCacheMenu] = useState(false)
  // Add confirmation dialog state
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false)

  // New states for tag autocomplete
  const [tagInputValue, setTagInputValue] = useState("")
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [selectedTagIndex, setSelectedTagIndex] = useState(-1)

  // Cache management functions with improved debugging
  const saveToCache = useCallback((articlesData: Article[], highlightsData: ArticleWithHighlights[]) => {
    try {
      console.log("💾 Saving to cache:", {
        articlesCount: articlesData.length,
        highlightsCount: highlightsData.length,
        timestamp: new Date().toISOString(),
      })

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

      console.log("✅ Cache saved successfully")
    } catch (error) {
      console.error("❌ Failed to save data to cache:", error)
      // Show user-visible error
      alert("Failed to save data to cache. Your changes may not be persisted.")
    }
  }, [])

  const loadFromCache = useCallback(() => {
    try {
      const cachedDataString = localStorage.getItem(CACHE_KEY)
      if (cachedDataString) {
        console.log("📂 Loading from cache...")
        const cachedData: CachedData = JSON.parse(cachedDataString)
        setArticles(cachedData.articles)
        setHighlightData(cachedData.highlightData)
        setCacheInfo({
          timestamp: cachedData.timestamp,
          size: formatBytes(new Blob([cachedDataString]).size),
        })

        console.log("✅ Cache loaded successfully:", {
          articlesCount: cachedData.articles.length,
          highlightsCount: cachedData.highlightData.length,
          cacheDate: new Date(cachedData.timestamp).toISOString(),
        })

        // Hide upload section if we have both types of data
        if (cachedData.articles.length > 0 && cachedData.highlightData.length > 0) {
          setShowUploadSection(false)
        }

        return true
      }
    } catch (error) {
      console.error("❌ Failed to load data from cache:", error)
    }
    return false
  }, [])

  const clearCache = useCallback(() => {
    if (!showClearCacheConfirm) {
      setShowClearCacheConfirm(true)
      return
    }

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
      setShowReadOnly(false)
      setShowUnreadOnly(false)
      setSortBy("default")
      setCurrentPage(1)
      setFetchingTitles(new Set())
      setEditingTitle(null)
      setEditTitleValue("")
      setAddingHighlight(null)
      setNewHighlightText("")
      setShowAddArticle(false)
      setNewArticleUrl("")
      setNewArticleTitle("")
      setNewArticleTags("")
      setNewArticleIsFavorite(false)
      setShowCacheMenu(false)
      setShowClearCacheConfirm(false)
      console.log("🗑️ Cache cleared successfully")
    } catch (error) {
      console.error("❌ Failed to clear cache:", error)
    }
  }, [showClearCacheConfirm])

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

  // Save to cache whenever articles or highlights change - with improved debugging
  useEffect(() => {
    if (articles.length > 0 || highlightData.length > 0) {
      console.log("🔄 Articles or highlights changed, triggering cache save...", {
        articlesLength: articles.length,
        highlightDataLength: highlightData.length,
      })

      // Use a small delay to batch rapid updates
      const timeoutId = setTimeout(() => {
        saveToCache(articles, highlightData)
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [articles, highlightData, saveToCache])

  const parseTagsAndFavorites = useCallback((tagString: string) => {
    if (!tagString) return { tags: [], isFavorite: false }

    const tagParts = tagString
      .split("|")
      .map((tag) => tag.trim())
      .filter(Boolean)

    // Check for both "*" and "***" as favorite indicators
    const isFavorite = tagParts.includes("*") || tagParts.includes("***")
    const tags = tagParts.filter((tag) => tag !== "*" && tag !== "***")

    return { tags, isFavorite }
  }, [])

  const parseCSV = useCallback(
    (csvText: string): Article[] => {
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
    },
    [parseTagsAndFavorites],
  )

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

  const handleZipUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      setZipLoading(true)
      try {
        const zip = new JSZip()
        const zipContent = await zip.loadAsync(file)

        let csvFile: JSZip.JSZipObject | null = null
        let jsonFile: JSZip.JSZipObject | null = null

        // Look for CSV and JSON files
        Object.keys(zipContent.files).forEach((filename) => {
          const file = zipContent.files[filename]
          if (!file.dir) {
            // Skip directories
            const lowerName = filename.toLowerCase()
            if (lowerName.endsWith(".csv") && !csvFile) {
              csvFile = file
            } else if (lowerName.endsWith(".json") && !jsonFile) {
              jsonFile = file
            }
          }
        })

        // Process CSV file if found
        if (csvFile) {
          try {
            const csvText = await csvFile.async("text")
            const parsedArticles = parseCSV(csvText)
            if (parsedArticles.length > 0) {
              setArticles(parsedArticles)
            }
          } catch (error) {
            console.error("Error parsing CSV from ZIP:", error)
            alert(`Error parsing CSV file: ${error instanceof Error ? error.message : "Unknown error"}`)
          }
        }

        // Process JSON file if found
        if (jsonFile) {
          try {
            const jsonText = await jsonFile.async("text")
            const parsedHighlights = JSON.parse(jsonText) as ArticleWithHighlights[]
            setHighlightData(parsedHighlights)
          } catch (error) {
            console.error("Error parsing JSON from ZIP:", error)
            alert(`Error parsing JSON file: ${error instanceof Error ? error.message : "Unknown error"}`)
          }
        }

        // Show results
        if (!csvFile && !jsonFile) {
          alert("No CSV or JSON files found in the ZIP archive.")
        } else {
          const messages = []
          if (csvFile) messages.push("articles CSV")
          if (jsonFile) messages.push("highlights JSON")
          alert(`Successfully imported ${messages.join(" and ")} from ZIP file.`)
        }
      } catch (error) {
        console.error("Error processing ZIP file:", error)
        alert("Error processing ZIP file. Please make sure it's a valid ZIP archive.")
      } finally {
        setZipLoading(false)
      }
    },
    [parseCSV],
  )

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

  // Function to fetch title from URL - improved with better error handling and debugging
  const fetchTitleFromUrl = useCallback(async (url: string) => {
    console.log(`🔍 Starting title fetch for: ${url}`)

    try {
      // Add URL to fetching set
      setFetchingTitles((prev) => {
        const newSet = new Set(prev).add(url)
        console.log(`⏳ Added to fetching set. Currently fetching: ${Array.from(newSet).length} titles`)
        return newSet
      })

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
        console.log(`✅ Title fetched successfully for ${url}: "${extractedTitle}"`)

        // Update the article with the new title
        setArticles((prevArticles) => {
          const updatedArticles = prevArticles.map((article) =>
            article.url === url ? { ...article, title: extractedTitle } : article,
          )

          console.log(`📝 Updated articles state with new title for ${url}`)
          return updatedArticles
        })

        return extractedTitle
      } else {
        throw new Error("No title found or title is same as URL")
      }
    } catch (error) {
      console.error(`❌ Failed to fetch title for ${url}:`, error)
      // You could show a toast notification here
      return null
    } finally {
      // Remove URL from fetching set
      setFetchingTitles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(url)
        console.log(`✅ Removed from fetching set. Currently fetching: ${Array.from(newSet).length} titles`)
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
        article.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getHighlightsForArticle(article.url).some((highlight) =>
          highlight.quote.toLowerCase().includes(searchTerm.toLowerCase()),
        )

      const matchesFavorites = !showFavoritesOnly || article.isFavorite
      const matchesHighlights = !showHighlightsOnly || getHighlightsForArticle(article.url).length > 0
      const matchesReadStatus =
        (!showReadOnly && !showUnreadOnly) ||
        (showReadOnly && article.status === "read") ||
        (showUnreadOnly && article.status !== "read")

      return matchesSearch && matchesFavorites && matchesHighlights && matchesReadStatus
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
  }, [
    articles,
    searchTerm,
    showFavoritesOnly,
    showHighlightsOnly,
    showReadOnly,
    showUnreadOnly,
    selectedTags,
    highlightData,
  ])

  // Then the filteredArticles useMemo can safely use getHighlightsForArticle
  const filteredArticles = useMemo(() => {
    const filtered = articles.filter((article) => {
      const matchesSearch =
        !searchTerm ||
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getHighlightsForArticle(article.url).some((highlight) =>
          highlight.quote.toLowerCase().includes(searchTerm.toLowerCase()),
        )

      const matchesTags = selectedTags.length === 0 || selectedTags.every((tag) => article.parsedTags.includes(tag))

      const matchesFavorites = !showFavoritesOnly || article.isFavorite

      const matchesHighlights = !showHighlightsOnly || getHighlightsForArticle(article.url).length > 0

      const matchesReadStatus =
        (!showReadOnly && !showUnreadOnly) ||
        (showReadOnly && article.status === "read") ||
        (showUnreadOnly && article.status !== "read")

      return matchesSearch && matchesTags && matchesFavorites && matchesHighlights && matchesReadStatus
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
  }, [
    articles,
    searchTerm,
    selectedTags,
    showFavoritesOnly,
    showHighlightsOnly,
    showReadOnly,
    showUnreadOnly,
    highlightData,
    sortBy,
  ])

  const startEditingTitle = useCallback((url: string, currentTitle: string) => {
    setEditingTitle(url)
    setEditTitleValue(currentTitle || url)
  }, [])

  const saveEditedTitle = useCallback(
    (url: string) => {
      if (editTitleValue.trim()) {
        console.log(`📝 Saving edited title for ${url}: "${editTitleValue.trim()}"`)

        setArticles((prevArticles) => {
          const updatedArticles = prevArticles.map((article) =>
            article.url === url ? { ...article, title: editTitleValue.trim() } : article,
          )

          console.log(`✅ Updated articles state with edited title for ${url}`)
          return updatedArticles
        })
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

  // New functions for adding articles
  const startAddingArticle = useCallback(() => {
    setShowAddArticle(true)
    setNewArticleUrl("")
    setNewArticleTitle("")
    setNewArticleTags("")
    setNewArticleIsFavorite(false)
  }, [])

  const cancelAddingArticle = useCallback(() => {
    setShowAddArticle(false)
    setNewArticleUrl("")
    setNewArticleTitle("")
    setNewArticleTags("")
    setNewArticleIsFavorite(false)
    // Reset tag input states
    setTagInputValue("")
    setShowTagSuggestions(false)
    setSelectedTagIndex(-1)
  }, [])

  const saveNewArticle = useCallback(async () => {
    if (!newArticleUrl.trim()) {
      alert("Please enter a URL for the article.")
      return
    }

    // Check if URL already exists
    const existingArticle = articles.find((article) => article.url === newArticleUrl.trim())
    if (existingArticle) {
      alert("An article with this URL already exists.")
      return
    }

    setAddingArticle(true)

    try {
      // Parse tags
      const { tags, isFavorite: tagBasedFavorite } = parseTagsAndFavorites(newArticleTags)

      // Determine if article is favorite (either from checkbox or tags)
      const isFavorite = newArticleIsFavorite || tagBasedFavorite

      // Create new article
      const newArticle: Article = {
        title: newArticleTitle.trim() || newArticleUrl.trim(),
        url: newArticleUrl.trim(),
        time_added: Math.floor(Date.now() / 1000), // Current timestamp
        tags: newArticleTags.trim(),
        status: "unread", // Always default to unread
        isFavorite,
        parsedTags: tags,
      }

      // Add to articles list (at the beginning for newest first)
      setArticles((prevArticles) => [newArticle, ...prevArticles])

      // If no title was provided, try to fetch it
      if (!newArticleTitle.trim()) {
        fetchTitleFromUrl(newArticleUrl.trim())
      }

      // Reset form and close
      cancelAddingArticle()
    } catch (error) {
      console.error("Error adding new article:", error)
      alert("Failed to add article. Please try again.")
    } finally {
      setAddingArticle(false)
    }
  }, [
    newArticleUrl,
    newArticleTitle,
    newArticleTags,
    newArticleIsFavorite,
    articles,
    fetchTitleFromUrl,
    cancelAddingArticle,
    parseTagsAndFavorites,
  ])

  // Tag management functions
  const parseTagsFromInput = useCallback((input: string) => {
    return input
      .split("|")
      .map((tag) => tag.trim())
      .filter(Boolean)
  }, [])

  const getSelectedTags = useCallback(() => {
    return parseTagsFromInput(newArticleTags)
  }, [newArticleTags, parseTagsFromInput])

  const getFilteredTagSuggestions = useCallback(() => {
    const currentTags = getSelectedTags()
    const inputValue = tagInputValue.toLowerCase().trim()

    if (!inputValue) return []

    return allUniqueTags
      .filter((tag) => tag.toLowerCase().includes(inputValue) && !currentTags.includes(tag))
      .slice(0, 8) // Limit to 8 suggestions
  }, [tagInputValue, allUniqueTags, getSelectedTags])

  const addTagFromSuggestion = useCallback(
    (tag: string) => {
      const currentTags = getSelectedTags()
      const newTags = [...currentTags, tag].join("|")
      setNewArticleTags(newTags)
      setTagInputValue("")
      setShowTagSuggestions(false)
      setSelectedTagIndex(-1)
    },
    [getSelectedTags],
  )

  const removeTag = useCallback(
    (tagToRemove: string) => {
      const currentTags = getSelectedTags()
      const newTags = currentTags.filter((tag) => tag !== tagToRemove).join("|")
      setNewArticleTags(newTags)
    },
    [getSelectedTags],
  )

  const handleTagInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const suggestions = getFilteredTagSuggestions()

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedTagIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
        setShowTagSuggestions(true)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedTagIndex((prev) => Math.max(prev - 1, -1))
      } else if (e.key === "Enter" && selectedTagIndex >= 0 && suggestions[selectedTagIndex]) {
        e.preventDefault()
        addTagFromSuggestion(suggestions[selectedTagIndex])
      } else if (e.key === "Enter" && tagInputValue.trim()) {
        e.preventDefault()
        addTagFromSuggestion(tagInputValue.trim())
      } else if (e.key === "Escape") {
        setShowTagSuggestions(false)
        setSelectedTagIndex(-1)
      } else if (e.key === "|" || e.key === "Tab") {
        e.preventDefault()
        if (tagInputValue.trim()) {
          addTagFromSuggestion(tagInputValue.trim())
        }
      }
    },
    [getFilteredTagSuggestions, selectedTagIndex, tagInputValue, addTagFromSuggestion],
  )

  const handleTagInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTagInputValue(value)
    setShowTagSuggestions(value.trim().length > 0)
    setSelectedTagIndex(-1)
  }, [])

  // Pagination calculations
  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(1)
  }, [
    searchTerm,
    selectedTags,
    showFavoritesOnly,
    showHighlightsOnly,
    showReadOnly,
    showUnreadOnly,
    itemsPerPage,
    sortBy,
  ])

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
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left side - Theme toggle and cache icon */}
            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle />
              {cacheInfo && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCacheMenu(!showCacheMenu)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title={`Cached: ${formatCacheDate(cacheInfo.timestamp)} (${cacheInfo.size})`}
                  >
                    <Database className="h-4 w-4" />
                  </Button>

                  {/* Cache menu dropdown */}
                  {showCacheMenu && (
                    <div className="absolute top-full right-0 sm:right-0 left-0 sm:left-auto mt-2 bg-background border border-border rounded-md shadow-lg p-3 min-w-64 max-w-80 z-50">
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground">
                          <div className="font-medium mb-1">Cache Information</div>
                          <div>Cached: {formatCacheDate(cacheInfo.timestamp)}</div>
                          <div>Size: {cacheInfo.size}</div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={() => {
                              setShowUploadSection(true)
                              setShowCacheMenu(false)
                            }}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                          >
                            <Upload className="h-3 w-3 mr-2" />
                            Upload
                          </Button>

                          {articles.length > 0 && (
                            <Button
                              onClick={() => {
                                downloadCachedData()
                                setShowCacheMenu(false)
                              }}
                              variant="outline"
                              size="sm"
                              className="w-full justify-start"
                            >
                              <Download className="h-3 w-3 mr-2" />
                              Export
                            </Button>
                          )}

                          {showClearCacheConfirm ? (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground text-center">
                                Are you sure? This will delete all cached data.
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={clearCache}
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Yes, Clear
                                </Button>
                                <Button
                                  onClick={() => setShowClearCacheConfirm(false)}
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              onClick={clearCache}
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Clear Cache
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Show upload/export buttons when no cache or upload section is visible */}
              {!cacheInfo && !showUploadSection && (
                <div className="flex gap-2">
                  <Button onClick={() => setShowUploadSection(true)} variant="outline" size="sm">
                    <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="text-xs sm:text-sm">Upload</span>
                  </Button>
                  {articles.length > 0 && (
                    <Button onClick={downloadCachedData} variant="outline" size="sm" className="bg-transparent">
                      <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">Export</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Right side - Add Article button */}
            {!showUploadSection && articles.length > 0 && (
              <Button onClick={startAddingArticle} variant="outline" size="sm" className="bg-transparent">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-sm">Add Article</span>
              </Button>
            )}
          </div>
        </div>

        {/* Upload Section */}
        {showUploadSection && (
          <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
            {/* Upload Mode Toggle */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-4 text-sm">
                <button
                  onClick={() => setUploadMode("zip")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    uploadMode === "zip"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ZIP Upload
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  onClick={() => setUploadMode("individual")}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    uploadMode === "individual"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Upload Individually
                </button>
              </div>
            </div>

            {/* ZIP Upload Mode */}
            {uploadMode === "zip" && (
              <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="h-5 w-5" />
                    Import from ZIP File
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Upload a ZIP file containing your Pocket export files (CSV + JSON). We'll automatically detect and
                    import both files for you.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Input
                      id="zip-upload"
                      type="file"
                      accept=".zip"
                      onChange={handleZipUpload}
                      disabled={loading || zipLoading}
                      className="cursor-pointer"
                    />
                    {zipLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing ZIP file...
                      </div>
                    )}
                    {(articles.length > 0 || highlightData.length > 0) && (
                      <div className="space-y-2">
                        {articles.length > 0 && (
                          <p className="text-sm text-green-600 flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            Loaded {articles.length} articles
                          </p>
                        )}
                        {highlightData.length > 0 && (
                          <p className="text-sm text-green-600 flex items-center gap-2">
                            <Check className="h-4 w-4" />
                            Loaded highlights for {highlightData.length} articles
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Individual Upload Mode */}
            {uploadMode === "individual" && (
              <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
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
                      <Input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        disabled={loading || zipLoading}
                      />
                      {articles.length > 0 && (
                        <p className="text-sm text-green-600">✓ Loaded {articles.length} articles</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <HighlightIcon className="h-5 w-5" />
                      Upload Highlights JSON
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Upload your Pocket highlights export file (optional)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Input
                        id="json-upload"
                        type="file"
                        accept=".json"
                        onChange={handleJSONUpload}
                        disabled={loading || zipLoading}
                      />
                      {highlightData.length > 0 && (
                        <p className="text-sm text-green-600">
                          ✓ Loaded highlights for {highlightData.length} articles
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Add Article Section */}
        {showAddArticle && (
          <Card className="mb-6 sm:mb-8 border-2 border-dashed border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5" />
                Add New Article
              </CardTitle>
              <CardDescription className="text-sm">Add a new article to your collection manually</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="new-article-url" className="text-sm font-medium mb-2 block">
                      URL <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="new-article-url"
                      type="url"
                      placeholder="https://example.com/article"
                      value={newArticleUrl}
                      onChange={(e) => setNewArticleUrl(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-article-title" className="text-sm font-medium mb-2 block">
                      Title <span className="text-xs text-muted-foreground">(optional - will auto-fetch if empty)</span>
                    </Label>
                    <Input
                      id="new-article-title"
                      type="text"
                      placeholder="Article title"
                      value={newArticleTitle}
                      onChange={(e) => setNewArticleTitle(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="new-article-tags" className="text-sm font-medium mb-2 block">
                    Tags <span className="text-xs text-muted-foreground">(type to see suggestions)</span>
                  </Label>

                  {/* Selected Tags Display */}
                  {getSelectedTags().length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2 p-2 bg-muted/30 rounded-md">
                      {getSelectedTags().map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1 text-xs">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:bg-white/20 dark:hover:bg-black/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Tag Input with Autocomplete */}
                  <div className="relative">
                    <Input
                      id="new-article-tags"
                      type="text"
                      placeholder={
                        getSelectedTags().length > 0 ? "Add another tag..." : "Start typing to see suggestions..."
                      }
                      value={tagInputValue}
                      onChange={handleTagInputChange}
                      onKeyDown={handleTagInputKeyDown}
                      onFocus={() => tagInputValue.trim() && setShowTagSuggestions(true)}
                      onBlur={() => {
                        // Delay hiding suggestions to allow clicking on them
                        setTimeout(() => {
                          setShowTagSuggestions(false)
                          setSelectedTagIndex(-1)
                        }, 200)
                      }}
                      className="h-10"
                    />

                    {/* Tag Suggestions Dropdown */}
                    {showTagSuggestions && getFilteredTagSuggestions().length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {getFilteredTagSuggestions().map((tag, index) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addTagFromSuggestion(tag)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                              index === selectedTagIndex ? "bg-muted" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{tag}</span>
                              <Badge variant="outline" className="text-xs">
                                {articles.filter((a) => a.parsedTags.includes(tag)).length}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    Press Enter, Tab, or | to add a tag. Use arrow keys to navigate suggestions.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="new-article-favorite"
                    checked={newArticleIsFavorite}
                    onCheckedChange={(checked) => setNewArticleIsFavorite(checked as boolean)}
                  />
                  <Label
                    htmlFor="new-article-favorite"
                    className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                  >
                    <Star className="h-4 w-4 text-yellow-500" />
                    Mark as Favorite
                  </Label>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={saveNewArticle}
                    disabled={addingArticle || !newArticleUrl.trim()}
                    className="flex-1 sm:flex-none"
                  >
                    {addingArticle ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Add Article
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={cancelAddingArticle}
                    variant="outline"
                    disabled={addingArticle}
                    className="flex-1 sm:flex-none bg-transparent"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
                <Button variant="ghost" size="sm" onClick={() => setShowStats(!showStats)}>
                  {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`${showStats ? "block" : "hidden"}`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    // Clear all filters to show total
                    setSearchTerm("")
                    setSelectedTags([])
                    setShowFavoritesOnly(false)
                    setShowHighlightsOnly(false)
                    setSortBy("default")
                    setShowFilters(true)
                  }}
                  className="text-center p-3 sm:p-0 hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                  title="Click to show all articles"
                >
                  <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.totalArticles}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Total</div>
                </button>
                <button
                  onClick={() => {
                    // Filter to show only read articles
                    setSearchTerm("")
                    setSelectedTags([])
                    setShowFavoritesOnly(false)
                    setShowHighlightsOnly(false)
                    setSortBy("default")
                    // We need to add a read status filter
                    setShowReadOnly(true)
                    setShowFilters(true)
                  }}
                  className="text-center p-3 sm:p-0 hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                  title="Click to show only read articles"
                >
                  <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.readArticles}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Read</div>
                </button>
                <button
                  onClick={() => {
                    // Filter to show only unread articles
                    setSearchTerm("")
                    setSelectedTags([])
                    setShowFavoritesOnly(false)
                    setShowHighlightsOnly(false)
                    setSortBy("default")
                    setShowReadOnly(false)
                    setShowUnreadOnly(true)
                    setShowFilters(true)
                  }}
                  className="text-center p-3 sm:p-0 hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                  title="Click to show only unread articles"
                >
                  <div className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {stats.unreadArticles}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Unread</div>
                </button>
                <button
                  onClick={() => {
                    // Filter to show only favorites
                    setSearchTerm("")
                    setSelectedTags([])
                    setShowFavoritesOnly(true)
                    setShowHighlightsOnly(false)
                    setShowReadOnly(false)
                    setShowUnreadOnly(false)
                    setSortBy("default")
                    setShowFilters(true)
                  }}
                  className="text-center p-3 sm:p-0 hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                  title="Click to show only favorite articles"
                >
                  <div className="text-lg sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.favoriteArticles}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Favorites</div>
                </button>
                <button
                  onClick={() => {
                    // Filter to show only articles with highlights
                    setSearchTerm("")
                    setSelectedTags([])
                    setShowFavoritesOnly(false)
                    setShowHighlightsOnly(true)
                    setShowReadOnly(false)
                    setShowUnreadOnly(false)
                    setSortBy("default")
                    setShowFilters(true)
                  }}
                  className="text-center p-3 sm:p-0 hover:bg-muted/50 rounded-md transition-colors cursor-pointer"
                  title="Click to show only articles with highlights"
                >
                  <div className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.articlesWithHighlights}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">With Highlights</div>
                </button>
                <div className="text-center p-3 sm:p-0">
                  <div className="text-lg sm:text-2xl font-bold text-pink-600 dark:text-pink-400">
                    {stats.totalHighlights}
                  </div>
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
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Filter className="h-5 w-5" />
                    Search & Filters
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                    {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className={`${showFilters ? "block" : "hidden"}`}>
                <div className="space-y-4">
                  {/* Search and Sort Row */}
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <Label htmlFor="search" className="text-sm font-medium mb-2 block">
                        Search Articles
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Search by title, URL, or highlights..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 h-11 sm:h-10"
                        />
                      </div>
                    </div>
                    <div className="w-full lg:w-48">
                      <Label htmlFor="sort-by" className="text-sm font-medium mb-2 block">
                        Sort by
                      </Label>
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
                        <Label
                          htmlFor="favorites-only"
                          className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                        >
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
                        <Label
                          htmlFor="highlights-only"
                          className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                        >
                          <HighlightIcon className="h-4 w-4 text-purple-500" />
                          Show With Highlights Only
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="read-only"
                          checked={showReadOnly}
                          onCheckedChange={(checked) => {
                            setShowReadOnly(checked as boolean)
                            if (checked) setShowUnreadOnly(false)
                          }}
                        />
                        <Label
                          htmlFor="read-only"
                          className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                        >
                          <Check className="h-4 w-4 text-green-500" />
                          Show Read Only
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="unread-only"
                          checked={showUnreadOnly}
                          onCheckedChange={(checked) => {
                            setShowUnreadOnly(checked as boolean)
                            if (checked) setShowReadOnly(false)
                          }}
                        />
                        <Label
                          htmlFor="unread-only"
                          className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                        >
                          <X className="h-4 w-4 text-orange-500" />
                          Show Unread Only
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
                      <Label htmlFor="items-per-page" className="text-xs font-medium">
                        Items per page:
                      </Label>
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
              </CardContent>
            </Card>

            {/* Articles List */}
            {/* Articles List - Masonry Layout */}
            <div className="columns-1 md:columns-2 xl:columns-3 gap-4 sm:gap-6 space-y-4 sm:space-y-6">
              {paginatedArticles.map((article, index) => {
                const highlights = getHighlightsForArticle(article.url)
                const waybackMachineUrl = `https://web.archive.org/web/${article.url}`
                const isFetchingTitle = fetchingTitles.has(article.url)
                const articleNeedsTitle = needsTitle(article)

                return (
                  <Card
                    key={startIndex + index}
                    className="group break-inside-avoid mb-4 sm:mb-6 hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header with title and actions */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {article.isFavorite && (
                                <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                {editingTitle === article.url ? (
                                  <div className="space-y-2">
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
                                      className="text-sm"
                                      autoFocus
                                    />
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => saveEditedTitle(article.url)}
                                        className="h-7 px-2 text-xs"
                                      >
                                        <Check className="h-3 w-3 mr-1" />
                                        Save
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={cancelEditingTitle}
                                        className="h-7 px-2 text-xs"
                                      >
                                        <X className="h-3 w-3 mr-1" />
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-sm leading-tight hover:text-primary transition-colors cursor-pointer block break-words line-clamp-3"
                                    title={`${article.title || article.url}\n\nClick to open article`}
                                  >
                                    {article.title || article.url}
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-1 flex-shrink-0">
                              {articleNeedsTitle && editingTitle !== article.url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => fetchTitleFromUrl(article.url)}
                                  disabled={isFetchingTitle}
                                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={isFetchingTitle ? "Fetching title..." : "Fetch title from webpage"}
                                >
                                  {isFetchingTitle ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Heading className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                              {editingTitle !== article.url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditingTitle(article.url, article.title)}
                                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Edit title"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                asChild
                              >
                                <a
                                  href={waybackMachineUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open on Wayback Machine"
                                >
                                  <img
                                    src={theme === "dark" ? "/internet-archive-inverted.png" : "/internet-archive.svg"}
                                    alt="Wayback Machine"
                                    className="h-3 w-3"
                                  />
                                </a>
                              </Button>
                            </div>
                          </div>

                          {/* Meta information */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(article.time_added)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge
                                variant={article.status === "read" ? "default" : "secondary"}
                                className="text-xs h-4 px-1.5"
                              >
                                {article.status}
                              </Badge>
                              {highlights.length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-purple-600 dark:text-purple-400 text-xs h-4 px-1.5"
                                >
                                  {highlights.length}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        {article.parsedTags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {article.parsedTags.slice(0, 3).map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="outline" className="text-xs h-4 px-1.5">
                                  {tag}
                                </Badge>
                              ))}
                              {article.parsedTags.length > 3 && (
                                <Badge variant="outline" className="text-xs h-4 px-1.5 text-muted-foreground">
                                  +{article.parsedTags.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Highlights section */}
                        {highlights.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-xs font-medium">
                                <HighlightIcon className="h-3 w-3" />
                                <span>Highlights ({highlights.length})</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startAddingHighlight(article.url)}
                                className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Add highlight"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {highlights.map((highlight, hIndex) => (
                                <div
                                  key={hIndex}
                                  className="bg-muted/30 p-3 rounded text-xs border-l-2 border-primary/30"
                                >
                                  <p className="italic mb-2 leading-relaxed break-words">"{highlight.quote}"</p>
                                  <p className="text-muted-foreground text-xs">{formatDate(highlight.created_at)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add highlight for articles without highlights */}
                        {highlights.length === 0 && addingHighlight !== article.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startAddingHighlight(article.url)}
                            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <HighlightIcon className="h-3 w-3 mr-1" />
                            Add Highlight
                          </Button>
                        )}

                        {/* New highlight input */}
                        {addingHighlight === article.url && (
                          <div className="space-y-2 p-2 bg-muted/20 rounded border-2 border-dashed border-muted-foreground/30">
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
                              placeholder="Enter highlight text..."
                              className="w-full min-h-[60px] p-2 text-xs bg-background border border-input rounded resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                              autoFocus
                            />
                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">Ctrl+Enter to save</p>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveNewHighlight(article.url)}
                                  disabled={!newHighlightText.trim()}
                                  className="h-6 px-2 text-xs"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelAddingHighlight}
                                  className="h-6 px-2 text-xs"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
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

        {/* Click outside to close cache menu */}
        {showCacheMenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowCacheMenu(false)
              setShowClearCacheConfirm(false)
            }}
          />
        )}
      </div>
    </div>
  )
}
