export class UserEntity {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'team_member' | 'admin';
  // Temporary stand-in for a TeamMembership table. Same meaning: which teams this user belongs to.
  teamIds: string[];
}
