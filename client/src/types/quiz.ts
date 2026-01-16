// src/types/quiz.ts

// 1. Định nghĩa khuôn mẫu cho khối VĂN BẢN
export interface TextBlock {
  type: 'text';
  content: string; // Chứa nội dung câu hỏi hoặc HTML
}

// 2. Định nghĩa khuôn mẫu cho khối HÌNH ẢNH
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

// 3. Gom tất cả các loại khối lại thành một kiểu chung
export type ContentBlock = TextBlock | ImageBlock | TableBlock | PoemBlock;

// 4. Định nghĩa khuôn mẫu cho một CÂU HỎI hoàn chỉnh
export interface QuestionData {
  id: number;
  
  // 👇 QUAN TRỌNG NHẤT: Bắt buộc blocks phải là mảng các ContentBlock
  blocks: ContentBlock[]; 
  // Các trường khác khớp với Database của bạn
  questionText: string;
  correctAnswer: string;
  // Định nghĩa cho choices (vì choices trong DB cũng là JSON)
  choices: {
    id: string;
    text: string;
  }[];
}