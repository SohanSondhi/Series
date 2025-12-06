export interface User {
    id: number;
    first_name: string;
    last_name: string;
    number: string;
    age?: number;
    location?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    profile_picture?: string;
    bio?: string;
    weekly_recap?: string;
    created_at: string;
    updated_at: string;
    connections?: User[];
}

export interface CreateUserData {
    first_name: string;
    last_name: string;
    number: string;
    age?: number;
    location?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    profile_picture?: string;
    bio?: string;
    weekly_recap?: string;
}

