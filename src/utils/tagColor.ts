// src/utils/tagColor.ts
// 標籤上色：依標籤字串雜湊分配固定色（同一標籤永遠同色）。
export const getTagColor = (tag: string): string => {
    const colors = [
        'text-pink-600 bg-pink-50',
        'text-blue-600 bg-blue-50',
        'text-orange-600 bg-orange-50',
        'text-purple-600 bg-purple-50',
        'text-cyan-600 bg-cyan-50',
    ];
    const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};
