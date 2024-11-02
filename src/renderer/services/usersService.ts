import axios from 'axios';

export const fetchUsers = async () => {
  const { data } = await axios.get('https://jsonplaceholder.typicode.com/users');
  return data.map((user: { id: number; name: string; email: string }) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    salary: Math.floor(Math.random() * 10000)
  }));
};

export const usersColumns = [
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
    header: 'Salary',
    accessorKey: 'salary',
    enableColumnFilter: false
  }
];
