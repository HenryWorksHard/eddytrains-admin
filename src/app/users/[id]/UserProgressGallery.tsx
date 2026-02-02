'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'

interface ProgressImage {
  id: string
  image_url: string
  notes: string | null
  created_at: string
}

interface UserProgressGalleryProps {
  userId: string
}

export default function UserProgressGallery({ userId }: UserProgressGalleryProps) {
  const [images, setImages] = useState<ProgressImage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchImages()
  }, [userId])

  const fetchImages = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('progress_images')
        .select('*')
        .eq('client_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setImages(data || [])
    } catch (err) {
      console.error('Failed to fetch progress images:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    })
  }

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedIndex === null) return
    if (direction === 'prev' && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    } else if (direction === 'next' && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  return (
    <>
      <div className="card p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <Camera className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Progress Pictures</h2>
          {images.length > 0 && (
            <span className="text-sm text-zinc-500">({images.length} photos)</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-8">
            <Camera className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No progress images yet</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-zinc-800/50 rounded-lg px-3 py-1.5">
                <span className="text-zinc-400 text-xs">
                  First: {formatDate(images[images.length - 1].created_at)}
                </span>
              </div>
              <div className="bg-zinc-800/50 rounded-lg px-3 py-1.5">
                <span className="text-zinc-400 text-xs">
                  Latest: {formatDate(images[0].created_at)}
                </span>
              </div>
            </div>

            {/* Image Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedIndex(idx)}
                  className="aspect-square relative rounded-lg overflow-hidden bg-zinc-800 hover:ring-2 hover:ring-purple-400 transition-all"
                >
                  <Image
                    src={img.image_url}
                    alt={`Progress ${formatDate(img.created_at)}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 25vw, 12vw"
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Full Image Viewer */}
      {selectedIndex !== null && images[selectedIndex] && (
        <div 
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center"
          onClick={() => setSelectedIndex(null)}
        >
          {selectedIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateImage('prev') }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
          {selectedIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateImage('next') }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}

          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div 
            className="relative w-full max-w-2xl h-[80vh] mx-4"
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={images[selectedIndex].image_url}
              alt={`Progress ${formatDate(images[selectedIndex].created_at)}`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 700px"
            />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-sm px-4 py-2 rounded-xl">
            <p className="text-white font-medium text-center">{formatDate(images[selectedIndex].created_at)}</p>
            <p className="text-zinc-500 text-xs text-center mt-1">
              {selectedIndex + 1} of {images.length}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
