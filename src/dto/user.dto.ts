// userDTO

export class UserDto {
    id!: number;
    steamid!: string;
    personaName?: string;
    avatar?: string;
    createdAt!: Date;
    updatedAt!: Date;
}
