export interface TextBlock {
  type: 'text';
  content: string; // Chứa nội dung câu hỏi hoặc HTML
}

export interface ImageBlock {
  type: 'image';
  src: string;      // Đường dẫn ảnh
  alt?: string;     // Text thay thế (optional)
  caption?: string; // Chú thích ảnh (optional)
}

export interface TableBlock {
  type: 'table';
  title?: string;
  headers: string[];
  rows: string[][];
  note?: string;
}

export interface PoemBlock {
  type: 'poem';
  title?: string;        // Tên bài thơ
  author?: string;       // Tác giả
  lines: string[];       // Mảng chứa từng dòng thơ (để xuống dòng cho chuẩn)
}

export interface NoteBlock {
  type: 'note';
  lines: string[];       // Mảng chứa từng dòng thơ (để xuống dòng cho chuẩn)
}

// 3. Gom tất cả các loại khối lại thành một kiểu chung
export type ContentBlock = TextBlock | ImageBlock | TableBlock | PoemBlock | NoteBlock;

// 4. Định nghĩa khuôn mẫu cho một CÂU HỎI hoàn chỉnh
export interface QuestionData {
  id: number;
  blocks: ContentBlock[];
  questionText: string;
  correctAnswer: string;
  choices: {
    id: string;
    text: string;
  }[];
  moduleIndex: number;
  type: 'MCQ' | 'SPR';
}

export interface TestItem {
  id: number;
  title: string;
  subject: string;
  mode: 'PRACTICE' | 'EXAM';
  duration: number;
  questionCount: number;
  folderId: number | null;
}

export interface AssignmentProps {
  id: string;
  title: string;
  content: string | null;
  fileUrls: string[];
  links: string[];
  deadline: string | null;
  createdAt: string;
  selectedTests?: TestItem[];
}