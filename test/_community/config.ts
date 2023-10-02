import { buildConfigWithDefaults } from "../buildConfigWithDefaults";
import { PostsCollection, postsSlug } from "./collections/Posts";
import { devUser } from "../credentials";

export default buildConfigWithDefaults({
  // ...extend config here
  collections: [PostsCollection],
  globals: [],
  graphQL: {
    schemaOutputFile: "./test/_community/schema.graphql",
  },

  onInit: async (payload) => {
    await payload.create({
      collection: "users",
      data: {
        email: devUser.email,
        password: devUser.password,
      },
    });
  },
});
