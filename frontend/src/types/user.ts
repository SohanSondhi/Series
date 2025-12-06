export interface User {
    id: number;
    first_name: string;
    last_name: string;
    number: string;
    location?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    profile_picture?: string;
    bio?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateUserData {
    first_name: string;
    last_name: string;
    number: string;
    location?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    profile_picture?: string;
    bio?: string;
}

