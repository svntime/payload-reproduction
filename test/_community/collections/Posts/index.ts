import type { CollectionConfig } from "../../../../src/collections/config/types";

export const postsSlug = "posts";

export const PostsCollection: CollectionConfig = {
  slug: postsSlug,
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === "update") return;

        const exampleArray = [...Array(1000)].map((_, id) => ({
          fieldA: `text a ${id}`,
          fieldB: `text b ${id}`,
          fieldC: id,
        }));

        return { ...data, exampleArray };
      },
    ],
  },
  fields: [
    {
      name: "text",
      type: "text",
    },
    {
      name: "exampleArray",
      type: "array",
      required: true,
      admin: {
        hidden: true,
      },
      fields: [
        {
          name: "fieldA",
          type: "text",
          required: true,
        },
        {
          name: "fieldB",
          type: "text",
          required: true,
        },
        {
          name: "fieldC",
          type: "number",
        },
      ],
    },
  ],
};
