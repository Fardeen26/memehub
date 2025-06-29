import { MetadataRoute } from 'next'
import { baseUrl } from '@/lib/constants'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  
  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
