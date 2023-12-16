/**
 * @module   gradientrenderer.js
 * @desc     renders to a text element, colors are realized with CSS gradients
 * @category renderer
 * @author   0x04 (ok@0x04.de)
 */

export default {
    preferredElementNodeName: 'PRE',
    render
}

const backBuffer = []
const types = ['color', 'backgroundColor']

let cols, rows

function render(context, buffer) {
    const element = context.settings.element

    // Detect resize
    if (context.rows !== rows || context.cols !== cols) {
        cols = context.cols
        rows = context.rows
        backBuffer.length = 0
    }

    // DOM rows update: expand lines if necessary
    // TODO: also benchmark a complete 'innerHTML' rewrite, could be faster?
    while (element.childElementCount < rows) {
        const span = document.createElement('span')
        span.style.setProperty('display', 'block')
        element.appendChild(span)
    }

    // DOM rows update: shorten lines if necessary
    // https://jsperf.com/innerhtml-vs-removechild/15
    while (element.childElementCount > rows) {
        element.removeChild(element.lastChild)
    }

    // Counts the number of updated rows, useful for debug
    let updatedRowNum = 0

    // A bit of a cumbersome render-loop…
    // A few notes: the fastest way I found to render the image
    // is by manually write the markup into the parent node via .innerHTML;
    // creating a node via .createElement and then popluate it resulted
    // remarkably slower (even if more elegant for the CSS handling below).
    for (let j = 0; j < rows; j++) {
        const offs = j * cols

        // This check is faster than to force update the DOM.
        // Buffer can be manually modified in pre, main and after
        // with semi-arbitrary values…
        // It is necessary to keep track of the previous state
        // and specifically check if a change in style
        // or char happened on the whole row.
        let rowNeedsUpdate = false

        for (let i = 0; i < cols; i++) {
            const idx = i + offs
            const newCell = buffer[idx]
            const oldCell = backBuffer[idx]
            if (!isSameCell(newCell, oldCell)) {
                if (!rowNeedsUpdate) updatedRowNum++
                rowNeedsUpdate = true
                backBuffer[idx] = {...newCell}
            }
        }

        // Skip row if update is not necessary
        if (!rowNeedsUpdate) continue

        const colorStops = {color: [], backgroundColor: []}
        let prevCell = {}

        for (let i = 0; i < cols; i++) {
            const currCell = buffer[i + offs] //|| {...defaultCell, char : EMPTY_CELL}

            for (let t = 0; t < types.length; t++) {
                const type = types.at(t)

                if (!isSameCellStyle(prevCell, currCell, type)) {
                    const colorStopTarget = colorStops[type]

                    if (prevCell[type]) {
                        colorStopTarget.push(createColorStop(prevCell[type], i))
                    }

                    const currentColor = currCell[type]
                        ?? context.settings[type]

                    colorStopTarget.push(createColorStop(currentColor, i))
                }

            }

            prevCell = currCell
        }

        // Write the row
        const row = element.childNodes[j]

        for (let t = 0; t < types.length; t++) {
            const type = types.at(t)
            const target = colorStops[type]

            if (target.length) {
                const lastColorStop = target.at(-1)
                const lastColorStopIndex = cols - 1

                target
                    .push(
                        createColorStop(lastColorStop.value, lastColorStopIndex),
                        createColorStop('transparent', lastColorStopIndex)
                    )

                const propertyName = (type === 'color') ? 'fg' : 'bg'
                const colorStops = getColorStops(target)

                row.style.setProperty(
                    `--gradient-renderer-line-${propertyName}`,
                    `content-box linear-gradient(90deg, ${colorStops}) no-repeat`
                )
            }
        }

        row.innerText = buffer
            .slice(offs, offs + cols - 1)
            .reduce((text, {char}) => text + char, '')
    }
}

// Compares two cells
function isSameCell(cellA, cellB) {
    return (typeof cellA === 'object')
        && (typeof cellB === 'object')
        && (cellA.char === cellB.char)
        && (cellA.color === cellB.color)
        && (cellA.backgroundColor === cellB.backgroundColor)
}

// Compares two cells for style only
function isSameCellStyle(cellA, cellB, type) {
    return (cellA[type] === cellB[type])
}

function getColorStops(colorStops) {
    return colorStops.reduce(
        (colorStopsString, colorStop) =>
            (colorStopsString ? `${colorStopsString},` : '')
            + `${colorStop.value} ${colorStop.index}ch`,
        ''
    )
}

const createColorStop = (value, index) => ({value, index})
