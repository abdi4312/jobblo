export type Tag = { name: string; type: string };

export type Job = {
  id: number;
  title: string;
  image: string;
  tags: Tag[];
  location: string;
  duration: string;
  date: string;
  price: string;
  rating: number;
  isNew?: boolean;
};

export const jobs: Job[] = [
  {
    id: 1,
    title: 'Maling av stue',
    image:
      'https://api.builder.io/api/v1/image/assets/TEMP/0d8e29846c42e592a0100389997853a366e46652?width=346',
    tags: [
      { name: 'Male', type: 'primary' },
      { name: 'Utstyr fri', type: 'secondary' }
    ],
    location: 'Gate 12 , Bærum',
    duration: '7 timer',
    date: '07.08.25',
    price: '350kr/ timen',
    rating: 1,
    isNew: true
  },
  {
    id: 2,
    title: 'Flyttehjelp',
    image:
      'https://api.builder.io/api/v1/image/assets/TEMP/4c7889944731b3b3a2b7a7b67a3f5ab1372d9ce1?width=346',
    tags: [{ name: 'Transport', type: 'primary' }],
    location: 'Oslo sentrum',
    duration: '3 timer',
    date: '10.08.25',
    price: '500kr/ total',
    rating: 4,
    isNew: false
  }
];
