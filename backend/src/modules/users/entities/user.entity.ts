export class UserEntity {
  id: string;
  idpSubjectId: string;
  name: string;
  email: string;
  role: 'employee' | 'team_member' | 'admin';
  createdAt: string;
}
