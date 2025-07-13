import type { CollectionConfig } from 'payload'

import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const postsSlug = 'posts'

export const postStatusOptions = {
  new: {
    label: 'New',
    value: 'new',
  },
  important: {
    label: 'Important',
    value: 'important',
  },
  optional: {
    label: 'Optional',
    value: 'optional',
  },
}

export const PostsCollection: CollectionConfig = {
  slug: postsSlug,
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      options: Object.values(postStatusOptions),
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [...defaultFeatures],
      }),
    },
  ],
}
