// Product-owned vector mark; keep RN and the native splash on the same generated asset.
import AppKit
let image = NSImage(size: NSSize(width: 288, height: 288))
image.lockFocus()
let card = NSBezierPath(roundedRect: NSRect(x: 16, y: 16, width: 256, height: 256), xRadius: 68, yRadius: 68)
NSGradient(starting: NSColor(srgbRed: 110/255, green: 107/255, blue: 242/255, alpha: 1), ending: NSColor(srgbRed: 0, green: 135/255, blue: 242/255, alpha: 1))!.draw(in: card, angle: -90)
let bubble = NSBezierPath()
bubble.move(to: NSPoint(x: 78, y: 89))
bubble.line(to: NSPoint(x: 67, y: 65))
bubble.line(to: NSPoint(x: 108, y: 80))
bubble.curve(to: NSPoint(x: 219, y: 146), controlPoint1: NSPoint(x: 170, y: 58), controlPoint2: NSPoint(x: 219, y: 90))
bubble.curve(to: NSPoint(x: 144, y: 214), controlPoint1: NSPoint(x: 219, y: 188), controlPoint2: NSPoint(x: 184, y: 214))
bubble.curve(to: NSPoint(x: 69, y: 146), controlPoint1: NSPoint(x: 102, y: 214), controlPoint2: NSPoint(x: 69, y: 187))
bubble.curve(to: NSPoint(x: 78, y: 89), controlPoint1: NSPoint(x: 69, y: 122), controlPoint2: NSPoint(x: 72, y: 107))
bubble.lineWidth = 10
bubble.lineJoinStyle = .round
NSColor.white.setStroke()
bubble.stroke()
NSColor.white.setFill()
for x in [112, 144, 176] { NSBezierPath(ovalIn: NSRect(x: x-5, y: 141, width: 10, height: 10)).fill() }
image.unlockFocus()
let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
