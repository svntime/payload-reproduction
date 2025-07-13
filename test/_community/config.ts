import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { fileURLToPath } from 'node:url'
import path from 'path'

import { buildConfigWithDefaults } from '../buildConfigWithDefaults.js'
import { devUser } from '../credentials.js'
import { MediaCollection } from './collections/Media/index.js'
import { PostsCollection, postsSlug, postStatusOptions } from './collections/Posts/index.js'
import { MenuGlobal } from './globals/Menu/index.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfigWithDefaults({
  // ...extend config here
  collections: [PostsCollection, MediaCollection],
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  db: postgresAdapter({
    pool: {
      connectionString: 'postgresql://postgres:postgres@localhost:5432/payload-reproduction',
    },
  }),
  editor: lexicalEditor({}),
  globals: [
    // ...add more globals here
    MenuGlobal,
  ],
  onInit: async (payload) => {
    await payload.create({
      collection: 'users',
      data: {
        email: devUser.email,
        password: devUser.password,
      },
    })

    const posts = [...Array(50).keys()].map((index) => ({
      title: `Post ${index + 1}`,
      status: postStatusOptions.new.value,
    }))

    await Promise.all(
      posts.map((post) =>
        payload.create({
          collection: postsSlug,
          data: post,
        }),
      ),
    )
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
