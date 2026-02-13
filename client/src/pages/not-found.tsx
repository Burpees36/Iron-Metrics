import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Page Not Found</h1>
            <p className="text-sm text-muted-foreground">
              The page you're looking for doesn't exist.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" data-testid="button-go-home">Back to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
