import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#1a1a1a',
        foreground: '#e5e5e5',
        cursor: '#00ff00',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Welcome message
    term.writeln('Welcome to the terminal!');
    term.writeln('This is a simulated terminal for demonstration.');
    term.writeln('');
    term.write('$ ');

    let currentLine = '';

    term.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 13) {
        // Enter key
        term.write('\r\n');
        if (currentLine.trim()) {
          handleCommand(term, currentLine.trim());
        }
        currentLine = '';
        term.write('$ ');
      } else if (code === 127) {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (code >= 32) {
        // Printable characters
        currentLine += data;
        term.write(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  const handleCommand = (term: XTerm, command: string) => {
    const parts = command.split(' ');
    const cmd = parts[0];

    switch (cmd) {
      case 'help':
        term.writeln('Available commands:');
        term.writeln('  help     - Show this help message');
        term.writeln('  clear    - Clear the terminal');
        term.writeln('  echo     - Echo back arguments');
        term.writeln('  date     - Show current date and time');
        term.writeln('  whoami   - Display current user');
        break;
      case 'clear':
        term.clear();
        break;
      case 'echo':
        term.writeln(parts.slice(1).join(' '));
        break;
      case 'date':
        term.writeln(new Date().toString());
        break;
      case 'whoami':
        term.writeln('presenter');
        break;
      default:
        term.writeln(`Command not found: ${cmd}`);
        term.writeln('Type "help" for available commands');
    }
  };

  return <div ref={terminalRef} className="h-full w-full" />;
}
