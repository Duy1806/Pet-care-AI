/**
 * PawCare AI — Care Reminder Domain Entity
 *
 * Represents daily care activities (feeding, walks, medicine, grooming, hygiene)
 * scheduled by pet owners.
 */
export type CareCategory =
  | 'feeding'
  | 'medication'
  | 'exercise'
  | 'grooming'
  | 'hygiene'
  | 'water'
  | 'other';

export interface CareReminder {
  id: string;
  petId: string;
  ownerId?: string;
  title: string;
  time: string; // e.g. "07:30"
  category: CareCategory;
  icon: string; // MaterialCommunityIcons name
  isDone: boolean;
  date: string; // YYYY-MM-DD
  createdAt?: string;
}

export interface CareSuggestion {
  id: string;
  title: string;
  time: string;
  category: CareCategory;
  icon: string;
  description: string;
  species: 'all' | 'dog' | 'cat';
}

export const CARE_SUGGESTIONS: CareSuggestion[] = [
  // DOG SUGGESTIONS
  {
    id: 's_dog_breakfast',
    title: 'Bữa sáng hạt & dinh dưỡng',
    time: '07:30',
    category: 'feeding',
    icon: 'food-drumstick',
    description: 'Cung cấp năng lượng khởi đầu ngày mới cho bé',
    species: 'dog',
  },
  {
    id: 's_dog_water',
    title: 'Thay nước lọc sạch mới',
    time: '08:00',
    category: 'water',
    icon: 'water-pump',
    description: 'Giữ khay nước uống luôn mát và sạch khuẩn',
    species: 'dog',
  },
  {
    id: 's_dog_vitamin',
    title: 'Uống men tiêu hóa / Vitamin',
    time: '08:30',
    category: 'medication',
    icon: 'pill',
    description: 'Bổ sung lợi khuẩn đường ruột & tăng đề kháng',
    species: 'dog',
  },
  {
    id: 's_dog_walk',
    title: 'Đi dạo & vận động ngoài trời',
    time: '17:30',
    category: 'exercise',
    icon: 'run-fast',
    description: '30 phút đi dạo giải tỏa stress & tiêu hao năng lượng',
    species: 'dog',
  },
  {
    id: 's_dog_dinner',
    title: 'Bữa tối giàu đạm phục hồi',
    time: '19:00',
    category: 'feeding',
    icon: 'bowl-mix',
    description: 'Khẩu phần ăn tối theo lượng calo MER',
    species: 'dog',
  },
  {
    id: 's_dog_brush',
    title: 'Chải lông & lau sạch chân',
    time: '20:30',
    category: 'grooming',
    icon: 'brush',
    description: 'Kiểm tra kẽ chân, ngừa ve rận & gỡ rối lông',
    species: 'dog',
  },
  {
    id: 's_dog_teeth',
    title: 'Đánh răng / Cho gặm que sạch răng',
    time: '21:00',
    category: 'hygiene',
    icon: 'tooth-outline',
    description: 'Ngừa cao răng, viêm nướu & khử hôi miệng',
    species: 'dog',
  },

  // CAT SUGGESTIONS
  {
    id: 's_cat_breakfast',
    title: 'Bữa sáng hạt + pate dinh dưỡng',
    time: '07:30',
    category: 'feeding',
    icon: 'food-drumstick',
    description: 'Bổ sung đạm và nước qua thức ăn ướt',
    species: 'cat',
  },
  {
    id: 's_cat_water',
    title: 'Thay nước lọc / Vệ sinh vòi nước',
    time: '08:00',
    category: 'water',
    icon: 'water-pump',
    description: 'Mèo thích nước mới chảy để ngừa sỏi thận',
    species: 'cat',
  },
  {
    id: 's_cat_litter',
    title: 'Dọn sạch khay cát vệ sinh',
    time: '08:30',
    category: 'hygiene',
    icon: 'tray-full',
    description: 'Khay cát sạch giúp bé đi vệ sinh đúng chỗ & thoải mái',
    species: 'cat',
  },
  {
    id: 's_cat_play',
    title: 'Chơi đùa vận động với cần câu',
    time: '18:00',
    category: 'exercise',
    icon: 'cat',
    description: '15-20 phút tương tác kích thích bản năng săn mồi',
    species: 'cat',
  },
  {
    id: 's_cat_dinner',
    title: 'Bữa tối pate / thức ăn yêu thích',
    time: '19:30',
    category: 'feeding',
    icon: 'bowl-mix',
    description: 'Cung cấp năng lượng buổi tối ấm bụng',
    species: 'cat',
  },
  {
    id: 's_cat_hairball',
    title: 'Cho uống gel tiêu búi lông (Hairball)',
    time: '20:30',
    category: 'medication',
    icon: 'pill',
    description: 'Hỗ trợ tiêu hóa và đào thải búi lông ruột',
    species: 'cat',
  },
  {
    id: 's_cat_groom',
    title: 'Chải lông mượt & lau khóe mắt',
    time: '21:00',
    category: 'grooming',
    icon: 'brush',
    description: 'Loại bỏ lông rụng và giữ khóe mắt sạch ghèn',
    species: 'cat',
  },
];

