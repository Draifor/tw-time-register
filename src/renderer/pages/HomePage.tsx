import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ListTodo, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

function HomePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to TW Time Register</h1>
        <p className="text-muted-foreground text-lg">Track your work hours and sync them with TeamWork effortlessly.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Time Registration</CardTitle>
            </div>
            <CardDescription>Register your daily work hours with automatic calculations for end times.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/worktime">
              <Button className="w-full">
                Start Registering
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <ListTodo className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Task Management</CardTitle>
            </div>
            <CardDescription>Manage your TeamWork tasks and task types for quick time entry selection.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/tasks">
              <Button variant="outline" className="w-full">
                View Tasks
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
          <CardDescription>Your time tracking summary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">0h</div>
              <div className="text-sm text-muted-foreground">Today</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">0h</div>
              <div className="text-sm text-muted-foreground">This Week</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Pending Entries</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HomePage;
