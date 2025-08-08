import { useState } from 'react'
import { X, Download, ExternalLink, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from './ui/button'
import { Card } from './ui/card'
import { Badge } from './ui/badge'

import type { UpdateInfo } from '../../preload'

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  updateInfo: UpdateInfo | null
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
}

// Enhanced markdown parser for release notes
function parseReleaseNotes(text: string): JSX.Element {
  const lines = text.trim().split('\n').filter(line => line.trim())
  const elements: JSX.Element[] = []
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    
    // Skip empty lines
    if (!trimmedLine) return
    
    // Parse headers (### Text)
    if (trimmedLine.startsWith('### ')) {
      const headerText = trimmedLine.replace(/^### /, '').trim()
      elements.push(
        <h4 key={`header-${index}`} className="text-base font-semibold text-foreground mb-3 mt-4 first:mt-0">
          {headerText}
        </h4>
      )
      return
    }
    
    // Parse bullet points (- ✨ Text)
    if (trimmedLine.startsWith('- ')) {
      const bulletText = trimmedLine.replace(/^- /, '').trim()
      const parsedText = parseBoldMarkdown(bulletText)
      elements.push(
        <div key={`bullet-${index}`} className="flex items-start gap-3 mb-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0" />
          <div className="text-sm text-muted-foreground flex-1">
            {parsedText}
          </div>
        </div>
      )
      return
    }
    
    // Parse regular paragraphs
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const parsedText = parseBoldMarkdown(trimmedLine)
      elements.push(
        <p key={`para-${index}`} className="text-sm text-muted-foreground mb-2">
          {parsedText}
        </p>
      )
    }
  })
  
  return <div className="space-y-1">{elements}</div>
}

// Helper function to parse markdown bold formatting
function parseBoldMarkdown(text: string): JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Remove the ** and make it bold
          const boldText = part.slice(2, -2)
          return (
            <span key={index} className="font-semibold text-foreground">
              {boldText}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

export function UpdateModal({ 
  isOpen, 
  onClose, 
  updateInfo, 
  isError = false, 
  errorMessage, 
  onRetry 
}: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadComplete, setDownloadComplete] = useState(false)

  const handleDownload = async () => {
    if (!updateInfo?.downloadUrl) return

    try {
      setIsDownloading(true)
      
      // Open the download URL in the default browser
      await window.electronAPI.system.openExternal(updateInfo.downloadUrl)
      
      // Simulate download completion for UI feedback
      setTimeout(() => {
        setIsDownloading(false)
        setDownloadComplete(true)
      }, 2000)
      
    } catch (error) {
      console.error('Error downloading update:', error)
      setIsDownloading(false)
    }
  }

  const handleClose = () => {
    setIsDownloading(false)
    setDownloadComplete(false)
    onClose()
  }

  if (!updateInfo && !isError) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative z-10 w-full max-w-2xl mx-4"
          >
            <Card className="bg-card border border-border shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  {isError ? (
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  ) : updateInfo?.available ? (
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-blue-500" />
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {isError 
                        ? 'Update Check Failed' 
                        : updateInfo?.available 
                          ? 'Update Available' 
                          : 'No Updates Available'
                      }
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Marvel Rivals Mod Manager
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-6">
                {isError ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      Unable to Check for Updates
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {errorMessage || 'Failed to connect to the update server. Please check your internet connection and try again.'}
                    </p>
                    {onRetry && (
                      <Button
                        onClick={onRetry}
                        variant="outline"
                        className="mb-4"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                    )}
                  </div>
                ) : updateInfo?.available ? (
                  <div className="space-y-6">
                    {/* Version Comparison */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Current Version</p>
                        <Badge variant="outline" className="text-sm font-mono">
                          v{updateInfo.currentVersion}
                        </Badge>
                      </div>
                      <div className="flex-1 flex justify-center">
                        <div className="w-8 h-px bg-border relative">
                          <div className="absolute inset-y-0 right-0 w-2 h-2 bg-border transform rotate-45 translate-x-1 -translate-y-px border-r border-t border-border bg-background"></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Latest Version</p>
                        <Badge variant="default" className="text-sm font-mono bg-green-600 hover:bg-green-700">
                          v{updateInfo.latestVersion}
                        </Badge>
                      </div>
                    </div>

                    {/* Release Notes */}
                    {updateInfo.releaseNotes && (
                      <div>
                        <h3 className="text-lg font-medium text-foreground mb-3">Release Notes</h3>
                        <div className="max-h-48 overflow-y-auto bg-muted/30 rounded-lg border border-border p-4">
                          {parseReleaseNotes(updateInfo.releaseNotes)}
                        </div>
                      </div>
                    )}

                    {/* Published Date */}
                    {updateInfo.publishedAt && (
                      <div className="text-sm text-muted-foreground">
                        Released: {new Date(updateInfo.publishedAt).toLocaleDateString()}
                      </div>
                    )}

                    {/* Download Instructions */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Update Instructions
                          </p>
                          <p className="text-blue-800 dark:text-blue-200">
                            The setup file will download and open in your browser. 
                            Close this application before running the installer to complete the update.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      You're up to date!
                    </h3>
                    <p className="text-muted-foreground">
                      You're currently running the latest version (v{updateInfo.currentVersion})
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/20">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="min-w-20"
                >
                  Close
                </Button>
                
                {isError && onRetry && (
                  <Button
                    onClick={onRetry}
                    className="min-w-32 bg-blue-600 hover:bg-blue-700"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
                
                {!isError && updateInfo?.available && updateInfo.downloadUrl && (
                  <Button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="min-w-32 bg-green-600 hover:bg-green-700"
                  >
                    {isDownloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        Opening...
                      </>
                    ) : downloadComplete ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Download Started
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download Update
                      </>
                    )}
                  </Button>
                )}

                {!isError && updateInfo?.available && !updateInfo.downloadUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.electronAPI.system.openExternal(`https://github.com/${updateInfo.currentVersion}`)}
                    className="min-w-32"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Release
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}