import axios from 'axios';

export const fetchComments = async () => {
  const { data } = await axios.get('https://jsonplaceholder.typicode.com/comments');
  return data.map((comment: { id: number; name: string; email: string; body: string }) => ({
    id: comment.id,
    name: comment.name,
    email: comment.email,
    body: comment.body
  }));
};

export const commentsColumns = [
  {
    header: 'ID',
    accessorKey: 'id',
    enableColumnFilter: false
  },
  {
    header: 'Name',
    accessorKey: 'name',
    enableColumnFilter: true
  },
  {
    header: 'Email',
    accessorKey: 'email',
    enableColumnFilter: true
  },
  {
    header: 'Body',
    accessorKey: 'body',
    enableColumnFilter: true
  }
];
