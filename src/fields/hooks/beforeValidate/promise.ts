/* eslint-disable no-param-reassign */
import { PayloadRequest, RequestContext } from '../../../express/types';
import { Field, fieldAffectsData, TabAsField, tabHasName, valueIsValueWithRelation } from '../../config/types';
import getValueWithDefault from '../../getDefaultValue';
import { cloneDataFromOriginalDoc } from '../beforeChange/cloneDataFromOriginalDoc';
import { getExistingRowDoc } from '../beforeChange/getExistingRowDoc';
import { traverseFields } from './traverseFields';

type Args<T> = {
  data: T
  doc: T
  field: Field | TabAsField
  id?: string | number
  operation: 'create' | 'update'
  overrideAccess: boolean
  req: PayloadRequest
  siblingData: Record<string, unknown>
  siblingDoc: Record<string, unknown>
  context: RequestContext
}

// This function is responsible for the following actions, in order:
// - Sanitize incoming data
// - Execute field hooks
// - Execute field access control
// - Merge original document data into incoming data
// - Compute default values for undefined fields

export const promise = async <T>({
  data,
  doc,
  field,
  id,
  operation,
  overrideAccess,
  req,
  siblingData,
  siblingDoc,
  context,
}: Args<T>): Promise<void> => {
  if (fieldAffectsData(field)) {
    if (field.name === 'id') {
      if (field.type === 'number' && typeof siblingData[field.name] === 'string') {
        const value = siblingData[field.name] as string;

        siblingData[field.name] = parseFloat(value);
      }

      if (field.type === 'text' && typeof siblingData[field.name]?.toString === 'function' && typeof siblingData[field.name] !== 'string') {
        siblingData[field.name] = siblingData[field.name].toString();
      }
    }

    // Sanitize incoming data
    switch (field.type) {
      case 'number': {
        if (typeof siblingData[field.name] === 'string') {
          const value = siblingData[field.name] as string;
          const trimmed = value.trim();
          siblingData[field.name] = (trimmed.length === 0) ? null : parseFloat(trimmed);
        }

        break;
      }

      case 'point': {
        if (Array.isArray(siblingData[field.name])) {
          siblingData[field.name] = (siblingData[field.name] as string[]).map((coordinate, i) => {
            if (typeof coordinate === 'string') {
              const value = siblingData[field.name][i] as string;
              const trimmed = value.trim();
              return (trimmed.length === 0) ? null : parseFloat(trimmed);
            }
            return coordinate;
          });
        }

        break;
      }

      case 'checkbox': {
        if (siblingData[field.name] === 'true') siblingData[field.name] = true;
        if (siblingData[field.name] === 'false') siblingData[field.name] = false;
        if (siblingData[field.name] === '') siblingData[field.name] = false;

        break;
      }

      case 'richText': {
        if (typeof siblingData[field.name] === 'string') {
          try {
            const richTextJSON = JSON.parse(siblingData[field.name] as string);
            siblingData[field.name] = richTextJSON;
          } catch {
            // Disregard this data as it is not valid.
            // Will be reported to user by field validation
          }
        }

        break;
      }

      case 'relationship':
      case 'upload': {
        if (siblingData[field.name] === '' || siblingData[field.name] === 'none' || siblingData[field.name] === 'null' || siblingData[field.name] === null) {
          if (field.type === 'relationship' && field.hasMany === true) {
            siblingData[field.name] = [];
          } else {
            siblingData[field.name] = null;
          }
        }

        const value = siblingData[field.name];

        if (Array.isArray(field.relationTo)) {
          if (Array.isArray(value)) {
            value.forEach((relatedDoc: { value: unknown, relationTo: string }, i) => {
              const relatedCollection = req.payload.config.collections.find((collection) => collection.slug === relatedDoc.relationTo);
              const relationshipIDField = relatedCollection.fields.find((collectionField) => fieldAffectsData(collectionField) && collectionField.name === 'id');
              if (relationshipIDField?.type === 'number') {
                siblingData[field.name][i] = { ...relatedDoc, value: parseFloat(relatedDoc.value as string) };
              }
            });
          }
          if (field.type === 'relationship' && field.hasMany !== true && valueIsValueWithRelation(value)) {
            const relatedCollection = req.payload.config.collections.find((collection) => collection.slug === value.relationTo);
            const relationshipIDField = relatedCollection.fields.find((collectionField) => fieldAffectsData(collectionField) && collectionField.name === 'id');
            if (relationshipIDField?.type === 'number') {
              siblingData[field.name] = { ...value, value: parseFloat(value.value as string) };
            }
          }
        } else {
          if (Array.isArray(value)) {
            value.forEach((relatedDoc: unknown, i) => {
              const relatedCollection = req.payload.config.collections.find((collection) => collection.slug === field.relationTo);
              const relationshipIDField = relatedCollection.fields.find((collectionField) => fieldAffectsData(collectionField) && collectionField.name === 'id');
              if (relationshipIDField?.type === 'number') {
                siblingData[field.name][i] = parseFloat(relatedDoc as string);
              }
            });
          }
          if (field.type === 'relationship' && field.hasMany !== true && value) {
            const relatedCollection = req.payload.config.collections.find((collection) => collection.slug === field.relationTo);
            const relationshipIDField = relatedCollection.fields.find((collectionField) => fieldAffectsData(collectionField) && collectionField.name === 'id');
            if (relationshipIDField?.type === 'number') {
              siblingData[field.name] = parseFloat(value as string);
            }
          }
        }
        break;
      }

      case 'array':
      case 'blocks': {
        // Handle cases of arrays being intentionally set to 0
        if (siblingData[field.name] === '0' || siblingData[field.name] === 0) {
          siblingData[field.name] = [];
        }

        break;
      }

      default: {
        break;
      }
    }

    // Execute hooks
    if (field.hooks?.beforeValidate) {
      await field.hooks.beforeValidate.reduce(async (priorHook, currentHook) => {
        await priorHook;

        const hookedValue = await currentHook({
          value: siblingData[field.name],
          originalDoc: doc,
          data,
          siblingData,
          operation,
          req,
          context,
        });

        if (hookedValue !== undefined) {
          siblingData[field.name] = hookedValue;
        }
      }, Promise.resolve());
    }

    // Execute access control
    if (field.access && field.access[operation]) {
      const result = overrideAccess ? true : await field.access[operation]({ req, id, siblingData, data, doc });

      if (!result) {
        delete siblingData[field.name];
      }
    }

    if (typeof siblingData[field.name] === 'undefined') {
      // If no incoming data, but existing document data is found, merge it in
      if (typeof siblingDoc[field.name] !== 'undefined') {
        siblingData[field.name] = cloneDataFromOriginalDoc(siblingDoc[field.name]);

        // Otherwise compute default value
      } else if (typeof field.defaultValue !== 'undefined') {
        siblingData[field.name] = await getValueWithDefault({
          value: siblingData[field.name],
          defaultValue: field.defaultValue,
          locale: req.locale,
          user: req.user,
        });
      }
    }
  }

  // Traverse subfields
  switch (field.type) {
    case 'group': {
      let groupData = siblingData[field.name] as Record<string, unknown>;
      let groupDoc = siblingDoc[field.name] as Record<string, unknown>;

      if (typeof siblingData[field.name] !== 'object') groupData = {};
      if (typeof siblingDoc[field.name] !== 'object') groupDoc = {};

      await traverseFields({
        data,
        doc,
        fields: field.fields,
        id,
        operation,
        overrideAccess,
        req,
        siblingData: groupData,
        siblingDoc: groupDoc,
        context,
      });

      break;
    }

    case 'array': {
      const rows = siblingData[field.name];

      if (Array.isArray(rows)) {
        const promises = [];
        rows.forEach((row, i) => {
          promises.push(traverseFields({
            data,
            doc,
            fields: field.fields,
            id,
            operation,
            overrideAccess,
            req,
            siblingData: row,
            siblingDoc: getExistingRowDoc(row, siblingDoc[field.name]),
            context,
          }));
        });
        await Promise.all(promises);
      }
      break;
    }

    case 'blocks': {
      const rows = siblingData[field.name];

      if (Array.isArray(rows)) {
        const promises = [];
        rows.forEach((row, i) => {
          const block = field.blocks.find((blockType) => blockType.slug === row.blockType);

          if (block) {
            promises.push(traverseFields({
              data,
              doc,
              fields: block.fields,
              id,
              operation,
              overrideAccess,
              req,
              siblingData: row,
              siblingDoc: getExistingRowDoc(row, siblingDoc[field.name]),
              context,
            }));
          }
        });
        await Promise.all(promises);
      }

      break;
    }

    case 'row':
    case 'collapsible': {
      await traverseFields({
        data,
        doc,
        fields: field.fields,
        id,
        operation,
        overrideAccess,
        req,
        siblingData,
        siblingDoc,
        context,
      });

      break;
    }

    case 'tab': {
      let tabSiblingData;
      let tabSiblingDoc;
      if (tabHasName(field)) {
        if (typeof siblingData[field.name] !== 'object') siblingData[field.name] = {};
        if (typeof siblingDoc[field.name] !== 'object') siblingDoc[field.name] = {};

        tabSiblingData = siblingData[field.name] as Record<string, unknown>;
        tabSiblingDoc = siblingDoc[field.name] as Record<string, unknown>;
      } else {
        tabSiblingData = siblingData;
        tabSiblingDoc = siblingDoc;
      }

      await traverseFields({
        data,
        doc,
        fields: field.fields,
        id,
        operation,
        overrideAccess,
        req,
        siblingData: tabSiblingData,
        siblingDoc: tabSiblingDoc,
        context,
      });

      break;
    }

    case 'tabs': {
      await traverseFields({
        data,
        doc,
        fields: field.tabs.map((tab) => ({ ...tab, type: 'tab' })),
        id,
        operation,
        overrideAccess,
        req,
        siblingData,
        siblingDoc,
        context,
      });

      break;
    }

    default: {
      break;
    }
  }
};
