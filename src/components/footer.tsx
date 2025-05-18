
export default function Footer() {
    return (
      <footer className="py-4 px-4 sm:px-6 mt-auto bg-card text-center">
        <div className="container mx-auto">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ClipGrab. All rights reserved.
          </p>
        </div>
      </footer>
    );
  }