export class CategoryEntity {
  id: string;
  name: string;
  defaultTeamId: string | null; // null only for "Other"
}
