export class UserEntity {
  id: string;
  idpSubjectId: string | null;
  name: string;
  email: string;
  role: 'employee' | 'team_member' | 'admin';
  active: boolean;
  teamIds: string[];
  createdAt: string;
}