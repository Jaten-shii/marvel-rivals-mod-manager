import { useState, useEffect } from 'react'
import { X, Upload, Download, Image, AlertCircle, Check } from 'lucide-react'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card } from './ui/card'
import { Select, SelectOption } from './ui/select'
import { cn } from 'renderer/lib/utils'

import type { ModInfo, ModCategory, Character, ModMetadata } from 'shared/types'
import { CATEGORIES, CHARACTERS } from 'shared/constants'

interface EditMetadataModalProps {
  mod: ModInfo | null
  isOpen: boolean
  onClose: () => void
  onSave: (modId: string, metadata: Partial<ModMetadata>) => Promise<void>
  className?: string
}

interface FormData {
  name: string
  category: ModCategory
  character?: Character
  description: string
  thumbnailFilePath?: string
  thumbnailUrl: string
}

export function EditMetadataModal({
  mod,
  isOpen,
  onClose,
  onSave,
  className,
}: EditMetadataModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: 'Skins',
    character: undefined,
    description: '',
    thumbnailUrl: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [thumbnailProtocolUrl, setThumbnailProtocolUrl] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form data when modal opens or mod changes
  useEffect(() => {
    if (mod && isOpen) {
      setFormData({
        name: mod.name,
        category: mod.category,
        character: mod.character,
        description: mod.metadata?.description || '',
        thumbnailUrl: '',
        thumbnailFilePath: undefined,
      })
      setHasChanges(false)
      setErrors({})
      setIsLoading(false)
      setThumbnailPreview(null)
      setThumbnailProtocolUrl(null)
      
      // Load existing thumbnail using protocol URL
      if (mod.thumbnailPath) {
        const loadThumbnailUrl = async () => {
          try {
            const fileName = mod.thumbnailPath!.split(/[\\/]/).pop() || ''
            const url = await window.electronAPI.system.getThumbnailUrl(fileName)
            setThumbnailProtocolUrl(url)
          } catch (error) {
            console.error('Error loading thumbnail URL:', error)
          }
        }
        loadThumbnailUrl()
      }
    }
  }, [mod, isOpen])

  // Create dropdown options
  const categoryOptions: SelectOption[] = Object.entries(CATEGORIES).map(([key, config]) => ({
    value: key as ModCategory,
    label: config.name,
  }))

  const characterOptions: SelectOption[] = [
    { value: '', label: 'No Character' },
    ...Object.entries(CHARACTERS).map(([key, config]) => ({
      value: key as Character,
      label: config.displayName,
    })),
  ]

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (formData.thumbnailUrl && !isValidImageUrl(formData.thumbnailUrl)) {
      newErrors.thumbnailUrl = 'Please enter a valid image URL (PNG, JPG, GIF, WebP)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const isValidImageUrl = (url: string): boolean => {
    try {
      new URL(url)
      return /\.(png|jpg|jpeg|gif|webp)$/i.test(url)
    } catch {
      return false
    }
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({ ...prev, category: category as ModCategory }))
    setHasChanges(true)
  }

  const handleCharacterChange = (character: string) => {
    setFormData(prev => ({ 
      ...prev, 
      character: character === '' ? undefined : character as Character 
    }))
    setHasChanges(true)
  }

  const handleFileSelect = async () => {
    try {
      const filePaths = await window.electronAPI.fs.selectFiles({
        filters: [
          { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        ],
        properties: ['openFile'],
      })

      if (filePaths && filePaths.length > 0) {
        const filePath = filePaths[0]
        setFormData(prev => ({ 
          ...prev, 
          thumbnailFilePath: filePath,
          thumbnailUrl: '' 
        }))
        setThumbnailPreview(`file://${filePath}`)
        setHasChanges(true)
        // Clear any previous URL errors
        if (errors.thumbnailUrl) {
          setErrors(prev => {
            const newErrors = { ...prev }
            delete newErrors.thumbnailUrl
            return newErrors
          })
        }
      }
    } catch (error) {
      console.error('Error selecting file:', error)
      setErrors(prev => ({ ...prev, thumbnailFile: 'Failed to select file. Please try again.' }))
    }
  }

  const handleUrlLoad = () => {
    if (formData.thumbnailUrl && isValidImageUrl(formData.thumbnailUrl)) {
      setThumbnailPreview(formData.thumbnailUrl)
      setFormData(prev => ({ ...prev, thumbnailFilePath: undefined }))
      setHasChanges(true)
      // Clear any previous file errors
      if (errors.thumbnailFile) {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors.thumbnailFile
          return newErrors
        })
      }
    }
  }

  const handleSave = async () => {
    if (!mod || !validateForm()) return

    setIsLoading(true)
    try {
      const metadata: Partial<ModMetadata> = {
        title: formData.name,
        description: formData.description,
        category: formData.category,
        character: formData.character,
      }

      // Handle thumbnail upload/download
      if (formData.thumbnailFilePath) {
        try {
          // Upload file thumbnail
          const thumbnailPath = await window.electronAPI.thumbnail.save(
            mod.id,
            formData.thumbnailFilePath,
            mod.originalFileName
          )
          metadata.customThumbnail = thumbnailPath
        } catch (error) {
          console.error('Error saving thumbnail file:', error)
          setErrors({ thumbnailFile: 'Failed to save thumbnail. Please try again.' })
          setIsLoading(false)
          return
        }
      } else if (formData.thumbnailUrl && isValidImageUrl(formData.thumbnailUrl)) {
        try {
          // Download URL thumbnail
          const thumbnailPath = await window.electronAPI.thumbnail.saveFromUrl(
            mod.id,
            formData.thumbnailUrl,
            mod.originalFileName
          )
          metadata.customThumbnail = thumbnailPath
        } catch (error) {
          console.error('Error downloading thumbnail:', error)
          setErrors({ thumbnailUrl: 'Failed to download thumbnail. Please check the URL and try again.' })
          setIsLoading(false)
          return
        }
      }

      await onSave(mod.id, metadata)
      setHasChanges(false)
      onClose()
    } catch (error) {
      console.error('Error saving metadata:', error)
      setErrors({ save: 'Failed to save metadata. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (mod) {
      setFormData({
        name: mod.name,
        category: mod.category,
        character: mod.character,
        description: mod.metadata?.description || '',
        thumbnailUrl: '',
        thumbnailFilePath: undefined,
      })
      setThumbnailPreview(null)
      
      // Reload the protocol URL
      if (mod.thumbnailPath) {
        const loadThumbnailUrl = async () => {
          try {
            const fileName = mod.thumbnailPath!.split(/[\\/]/).pop() || ''
            const url = await window.electronAPI.system.getThumbnailUrl(fileName)
            setThumbnailProtocolUrl(url)
          } catch (error) {
            console.error('Error loading thumbnail URL:', error)
          }
        }
        loadThumbnailUrl()
      } else {
        setThumbnailProtocolUrl(null)
      }
    }
    setHasChanges(false)
    setErrors({})
    setIsLoading(false)
    onClose()
  }

  if (!isOpen || !mod) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className={cn("w-full max-w-2xl max-h-[90vh] overflow-hidden animate-scale-in", className)}>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-2rem)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Edit Mod Metadata</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter mod name..."
                className={cn(errors.name && 'border-red-500')}
              />
              {errors.name && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  {errors.name}
                </div>
              )}
            </div>

            {/* Category and Character Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Category</Label>
                <Select
                  options={categoryOptions}
                  value={formData.category}
                  onValueChange={handleCategoryChange}
                  placeholder="Select category..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">Character</Label>
                <Select
                  options={characterOptions}
                  value={formData.character || ''}
                  onValueChange={handleCharacterChange}
                  placeholder="Select character..."
                />
              </div>
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description
              </Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter mod description..."
                rows={4}
                className={cn(
                  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50 resize-none'
                )}
              />
            </div>

            {/* Thumbnail Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Thumbnail</Label>
              
              {/* Current Thumbnail Preview */}
              {(thumbnailPreview || thumbnailProtocolUrl) && (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={thumbnailPreview || thumbnailProtocolUrl || ''}
                    alt="Thumbnail preview"
                    className="w-full h-full object-cover"
                    onError={() => {
                      setThumbnailPreview(null)
                      setThumbnailProtocolUrl(null)
                    }}
                  />
                </div>
              )}

              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Upload from File</Label>
                <Button
                  variant="outline"
                  onClick={handleFileSelect}
                  className="w-full justify-start"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select Image File
                </Button>
                {errors.thumbnailFile && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    {errors.thumbnailFile}
                  </div>
                )}
              </div>

              {/* URL Download */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Download from URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.thumbnailUrl}
                    onChange={(e) => handleInputChange('thumbnailUrl', e.target.value)}
                    placeholder="https://example.com/image.png"
                    className={cn(
                      'flex-1',
                      errors.thumbnailUrl && 'border-red-500'
                    )}
                  />
                  <Button
                    variant="outline"
                    onClick={handleUrlLoad}
                    disabled={!formData.thumbnailUrl || !isValidImageUrl(formData.thumbnailUrl)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                {errors.thumbnailUrl && (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    {errors.thumbnailUrl}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              {hasChanges ? (
                <>
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-400">
                    Unsaved changes
                  </span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">
                    No changes
                  </span>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!hasChanges || isLoading}
                className="min-w-20"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>

          {/* Save Error */}
          {errors.save && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                {errors.save}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}