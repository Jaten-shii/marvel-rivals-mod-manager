import { Plus, Search, Grid3X3, List, Settings, ArrowUpDown, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { cn } from 'renderer/lib/utils'

import type { ViewMode, SortBy } from 'shared/types'

interface ToolbarProps {
  searchQuery: string
  viewMode: ViewMode
  sortBy: SortBy
  totalMods: number
  enabledMods: number
  onSearchChange: (query: string) => void
  onViewModeChange: (mode: ViewMode) => void
  onSortChange: (sortBy: SortBy) => void
  onAddMod: () => void
  onOpenSettings: () => void
  className?: string
}

export function Toolbar({
  searchQuery,
  viewMode,
  sortBy,
  totalMods,
  enabledMods,
  onSearchChange,
  onViewModeChange,
  onSortChange,
  onAddMod,
  onOpenSettings,
  className,
}: ToolbarProps) {
  const [searchFocused, setSearchFocused] = useState(false)
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)

  const getSortLabel = (sort: SortBy): string => {
    switch (sort) {
      case 'installDate':
        return 'Sort by Date'
      case 'category':
        return 'Sort by Category'
      case 'character':
        return 'Sort by Character'
      default:
        return 'Sort by Date'
    }
  }

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'installDate', label: 'Date Installed' },
    { value: 'category', label: 'Category' },
    { value: 'character', label: 'Character' }
  ]

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (sortDropdownOpen) {
        setSortDropdownOpen(false)
      }
    }

    if (sortDropdownOpen) {
      // Use setTimeout to avoid immediate closure on the same click
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside)
      }
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [sortDropdownOpen])

  return (
    <Card className={cn(
      'p-4 bg-card border-border backdrop-blur-sm shadow-lg relative z-40 rounded-none',
      'dark:bg-card dark:border-border',
      className
    )}>
      <div className="flex items-center gap-4">
        {/* Left Section - Primary Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={onAddMod}
            className={cn(
              'bg-primary hover:bg-primary/90 text-primary-foreground font-medium',
              'transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95',
              'border border-primary/20'
            )}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Mod
          </Button>

        </div>

        {/* Center Section - Search */}
        <div className="flex-1 max-w-lg">
          <div className="relative">
            <Search className={cn(
              'absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4',
              searchFocused ? 'text-primary' : 'text-muted-foreground',
              'transition-colors duration-200'
            )} />
            <Input
              type="text"
              placeholder="Search mods..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={cn(
                'pl-10 pr-10 h-10 bg-card border-border',
                'transition-all duration-200 focus:ring-2 focus:ring-primary/50',
                'hover:border-primary/50',
                searchFocused && 'ring-2 ring-primary/50 border-primary/50',
                searchQuery && 'bg-accent/30'
              )}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8',
                  'hover:bg-accent/50 transition-all duration-200'
                )}
                onClick={() => onSearchChange('')}
              >
                ✕
              </Button>
            )}
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="relative z-50">
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              setSortDropdownOpen(!sortDropdownOpen)
            }}
            className={cn(
              'h-10 px-4 bg-card border-border text-white hover:text-white hover:bg-accent/50',
              'transition-all duration-200 flex items-center gap-2'
            )}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="text-sm font-medium">{getSortLabel(sortBy)}</span>
            <ChevronDown className={cn(
              'w-4 h-4 transition-transform duration-200',
              sortDropdownOpen && 'rotate-180'
            )} />
          </Button>

          {/* Sort Dropdown Menu */}
          {sortDropdownOpen && (
            <div className="absolute top-full mt-1 right-0 min-w-full w-max bg-popover border rounded-md shadow-lg z-[99999] isolate">
              <div className="py-1">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between whitespace-nowrap',
                      sortBy === option.value && 'bg-accent text-accent-foreground'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSortChange(option.value)
                      setSortDropdownOpen(false)
                    }}
                  >
                    <span>{option.label}</span>
                    {sortBy === option.value && (
                      <div className="w-2 h-2 bg-primary rounded-full ml-2" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Section - View Controls */}
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden bg-card">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'rounded-none border-none h-10 px-4',
                viewMode === 'grid' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                'transition-all duration-200'
              )}
              onClick={() => onViewModeChange('grid')}
              title="Grid View"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <div className="w-px bg-border" />
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'rounded-none border-none h-10 px-4',
                viewMode === 'list' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground',
                'transition-all duration-200'
              )}
              onClick={() => onViewModeChange('list')}
              title="List View"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          {/* Settings */}
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            title="Open Settings"
            className={cn(
              'transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95',
              'hover:rotate-90 border-border bg-card hover:bg-accent/50 h-10 w-10'
            )}
          >
            <Settings className="w-4 h-4 transition-transform duration-200" />
          </Button>
        </div>
      </div>

      {/* Search Results Info */}
      {searchQuery && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {totalMods > 0 ? (
                <>
                  Showing results for "
                  <span className="font-medium text-card-foreground bg-accent/30 px-1 rounded">
                    {searchQuery}
                  </span>
                  "
                </>
              ) : (
                <>
                  No results found for "
                  <span className="font-medium text-card-foreground bg-accent/30 px-1 rounded">
                    {searchQuery}
                  </span>
                  "
                </>
              )}
            </span>
            {totalMods > 0 && (
              <Badge variant="outline" className="text-xs font-medium">
                {totalMods} mod{totalMods !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}