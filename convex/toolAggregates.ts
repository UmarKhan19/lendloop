import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";

// Owner id first so a prefix count can scope to one member, while a plain
// count still covers every active listing.
export const activeTools = new TableAggregate<{
  Key: [Id<"users">, number];
  DataModel: DataModel;
  TableName: "tools";
}>(components.aggregate, {
  sortKey: (tool) => [tool.ownerId, tool._creationTime],
});
