export const generateRandomId = (): string => {
    return Math.random().toString(36).substr(2, 9);
};

export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

export const parseJson = (jsonString: string): any => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        throw new Error('Invalid JSON string');
    }
};