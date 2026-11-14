Su-27 Flanker has a spare, very recognisable look: turquoise aircraft, green terrain, a banded sky, and a cockpit packed with small instruments. The geometry is simple enough to invite inspection. The simulation behind it takes rather longer to understand.

We wanted to reconstruct the game in C++, following the work on [Darker](https://lost-engines.github.io/darker-discovered/), [TFX](https://lost-engines.github.io/tfx-traced/) and [Earthsiege](https://lost-engines.github.io/earthsiege-exhumed/). That meant recovering the files, finding out how the engine used them, and checking the new code against the original. Some of the more interesting problems came from damaged missions, a second landscape kept for old recordings, and a car whose windows only work if you draw it in the right order.

## Finding a reference version

The first job was sorting out what we actually had. The collection included DOS and Windows releases, demos, patches, regional packages and community modifications. A newer-looking disc was not necessarily a reliable guide to the files an installation would use. The Squadron Commander’s Edition disc, for example, contains an older `FSIM.EXE`; the installed 1.5 simulator runs from `FSIM.LBB`.

Extensions were another small trap. An `.LBB` file can be an archive or an executable. The DOS game has a launcher, a mission editor and a flight module; Windows has an editor executable and a separate flight module. We identified them by their headers.

We settled on a clean Windows Squadron Commander’s Edition 1.5 installation as the reconstruction reference, keeping the other editions for comparison. The DOS and Windows 1.1 releases share all four principal data archives byte for byte. Patch 1.2 changes the editor and flight executables while leaving the shared data alone. Version 1.5 changes the model collection substantially, but retains the earlier cockpit and terrain archives.

The final edition contains 364 shape resources and 208 distinct mission files. Those shapes include buildings, markings, weapons, wreckage and effects as well as vehicles. Twenty-six numbered Su-27 variants account for some of the growth: the mission’s aircraft type selects a paint scheme, while the geometry and flight data remain the same.

<figure class="wide"><img src="../images/original-external.png" width="640" height="480" class="pixel" loading="lazy" alt="Original Windows Flanker: a turquoise Su-27 on the runway, with a striped sky and green hills behind it."><figcaption>The original Windows 1.5 game, at 640 × 480.</figcaption></figure>

## A model file can open the landing gear

Decoding vertices and polygons gave us recognisable aircraft fairly early. Getting those aircraft to behave correctly in the model browser took more work. The Su-27 is assembled from 41 named shape nodes, with control surfaces, gear, canopy, pilot and afterburners under separate transforms. Some of the original names survive: `SubPilot`, `SubFonar`, `SubFlaps`, `SubForsaj`.

A parent shape can translate, rotate or scale a child, apply a curve to an input, test a flag, or attach another model. The game supplies a small set of parameters. The model decides what those values do to its parts. A single landing-gear input can therefore move several doors and struts through different stages of travel.

Our first browser gave everything a slider. We replaced the flag sliders with checkboxes for things like “pilot present” and “braking chutes”, and limited attachment selectors to the appropriate weapons and markings. Several controls only change over a small part of the available numerical range. The afterburner begins around 4096; most of a full signed-word slider did nothing.

Tracing the MiG-23’s wing-sweep input led back to the aircraft’s Mach number, multiplied by 4096. Curves in the model turn that into two short sweep transitions, with long plateaux between them. The browser now shows Mach beside the slider, so you can see where each transition happens.

The ejection sequence is split between `chear`, the seat, and `epilot`, the separated pilot. Their shapes contain the rocket, drogue, main parachute and body animation stages. Small random rotations add movement to the canopy. Try the parachutist’s deployment slider in the [model viewer](../models/#epilot), or the Il-76’s cargo ramp.

<figure class="wide"><a href="../models/#epilot"><img src="../images/model-exhibits.png" width="1440" height="720" loading="lazy" alt="Recovered Su-27 geometry beside the ejection seat and a pilot under an open parachute."></a><figcaption>Browser renders of the Su-27, ejection seat and parachutist, using the recovered model commands. <a href="../models/">Explore the models.</a></figcaption></figure>

## The car with the disappearing windows

One of the more awkward rendering bugs involved the least impressive vehicle in the collection. The little red `car1` model appeared to have a solid red rear windscreen. Rotate it far enough and a narrow white sliver would appear. The obvious suspects were reversed polygons or a bad normal.

The normals were fine. The rear window was entirely underneath the body panel. The front window intersected its panel, and its slope was slightly different too.

The original renderer gets away with this because the model supplies view-dependent drawing lists. They paint the body, then paint the window over it. A modern depth buffer compares the surfaces at each pixel and hides the buried window.

We checked four upright front and rear views by running the original software drawing code. The windows were visible there, and our recovered painter produced the same pixels. For the browser preview, we projected those two window faces onto their supporting panels and used the panels’ visibility.

Flags, hull lettering, wheels and grilles also needed attention to their drawing order. We had to read the drawing lists alongside the vertices to understand how these details were supposed to appear.

<figure><img src="../images/window-order.svg" width="960" height="370" loading="lazy" alt="Schematic cross-section: a window lies beneath the body panel. Painter order draws it last; a depth test hides it."><figcaption>The rear window lies beneath the body panel; separation exaggerated here. <a href="../models/#car1">Inspect the car.</a></figcaption></figure>

## Two renderers, much of the same work

Flanker’s flat mode draws in software. The Windows version also offers a smooth OpenGL mode. Both use much of the same rendering code.

The CPU transforms and clips the geometry, works out its drawing order, and projects it onto the screen. OpenGL receives the resulting two-dimensional polygons. Its imported entry points include 2D vertex calls and an orthographic projection.

That leaves the OpenGL path paying for the CPU geometry work as well as the overhead of submitting many small draws. We found the software path faster in the reconstruction, and have concentrated on improving it in Redux.

<figure class="wide"><img src="../images/rendering.svg" width="1100" height="370" loading="lazy" alt="Shapes and terrain pass through CPU animation, transforms, clipping and ordering, then split into software spans or projected OpenGL polygons."><figcaption>The recovered Windows rendering paths. Both start with the engine’s CPU geometry work.</figcaption></figure>

## The landscape kept for old recordings

Two terrain archives, `MAP` and `MAP0`, accompany the game. At first glance they look like candidates for different detail levels or graphics modes. Following mission startup gave us the answer: version 1.5 selects `MAP0` when replaying an old-format FM10 recording. A normal mission starts in the newer FM15 runtime and uses `MAP`.

Change the ground underneath a recorded low approach and the same controls may lead to a different landing—or a collision. Flanker keeps the older terrain alongside a legacy simulation path so it can replay those flights.

The full retail game includes airmanship lessons, aerobatics, air-combat sweeps and weapon demonstrations, with camera changes and briefings that invite the player to take over using Escape. The `.trk` files contain mission data followed by timed input; some `.mis` files also carry a recording after the mission section.

We ran 115 intact supplied tracks through to the end in the reconstruction. Three bonus tracks are truncated. For detailed state comparisons against the original simulation, we used two supplied mission recordings, running for 9,833 and 5,676 ticks.

<div class="aside"><p>The <a href="../missions/">mission map</a> shows a selection of the supplied scenarios over decoded MAP geometry. Select an aircraft to follow its planned route.</p></div>

## Four missions damaged by a newline conversion

Some of the bonus missions would not parse. Lengths and coordinates became nonsensical at particular places, then the surrounding structure became recognisable again.

Four files in the HMASP competition set had acquired a carriage-return byte before every line-feed byte. That is an ordinary conversion for a text file. In a binary mission, a byte with the value ten might be part of a coordinate, a count or any other field. Inserting a byte shifts everything after it.

Removing 42, 43, 45 and 42 inserted bytes got all four missions through the parser. Applying the newline conversion again reproduced each damaged file byte for byte, which gave us a useful check on the repair.

<figure><img src="../images/newlines.svg" width="960" height="280" loading="lazy" alt="A binary byte sequence 34 0A 12 becomes 34 0D 0A 12 after text-mode newline conversion, shifting the next field by one byte."><figcaption>An example of the byte insertion. The affected files were WARMUP, POWERUP, MISSION4 and MISSION5.</figcaption></figure>

## The Windows-looking DOS editor

The Windows mission editor uses native controls through MFC. The DOS editor looks similar enough that we wanted to know how much was shared. Its `MAPEWIN.RES` file contains standard Windows resource records, including dialog layouts. Every one of the 187 resources shared by the DOS and Windows 1.1 editors is byte-identical. Many remain unchanged in 1.5.

Both interfaces use the same dialog descriptions and artwork. DOS supplies its own drawing and input handling for those controls.

The editor also explains some of the game’s less obvious behaviour. “Declassify mission” asks for the mission author’s editing password. Classification restricts what can be edited: a squadron leader can change their player group, while a general has broader control over their side’s forces. The mission contents are stored in plain binary records. The short password field has its characters reversed and an offset added to each byte.

The weather resources contain three cloud labels—Clear, Light and Heavy—but the dialog code adds only the first two to the menu.

<figure class="wide pair"><div><img src="../images/dos-editor.png" width="640" height="480" class="pixel" loading="lazy" alt="DOS mission editor with its Windows-like Open dialog."><img src="../images/dos-weather.png" width="640" height="480" class="pixel" loading="lazy" alt="Weather dialog in the original DOS mission editor."></div><figcaption>The Open and Weather dialogs in the original DOS editor.</figcaption></figure>

## Giving the flight-model numbers names

The aerodynamic tables were easy to extract and harder to describe. A column of numbers is not much help to a future maintainer if all we can call it is “coefficient three”. We traced the calculations that consume each value, then changed one input at a time while running the original routine to see what moved.

That identified five Mach-dependent outputs: base drag, lift-dependent drag, lift slope, roll-command gain and the positive angle-of-attack command limit.

Ordinary-flight drag contains both a squared-lift term and a fourth-power term, which makes drag rise more sharply at high lift. Flap lift is added after the lift value used in those terms; flap drag is supplied separately. Pitch response follows a damped controller moving angle of attack towards a demand. Departure, tail-slide and Cobra manoeuvres have their own simulation states and equations.

<figure class="wide"><img src="../images/aerodynamics.svg" loading="lazy" alt="Recovered curves for drag, lift slope, roll-command gain and angle-of-attack command limit across Mach number."><figcaption>Outputs sampled from the original aerodynamic calculations. The discontinuities in roll gain and the AoA limit come from the original interpolation code.</figcaption></figure>

## Checking a reconstruction

For small routines, we can execute the original x86 instructions in a controlled harness, give both implementations the same inputs, and compare the outputs. This lets us check integer rounding, state transitions, drawing commands and individual pixels.

The cockpit was particularly suited to this. Its finished image combines palette artwork, one-bit symbols, vector lines, needles, warnings and separately rendered mirror views. We checked the component formats and composition code in stages, then compared the assembled frames. The [cockpit exhibit](../cockpit/) shows some of those pieces.

Longer tests exercised recorded flights, landing approaches and consecutive rendered frames. They caught integration errors that isolated functions could not. Playtesting found incorrect UI behaviour, culling problems at particular camera angles, and a chase camera using the wrong time scale.

The quick-reference card also missed a few controls. Ctrl+M toggles wingman messages, and holding Ctrl with the keypad makes external-camera movement four times faster.

## Where the work ended up

[Su-27 Flanker C++](https://github.com/Lost-Engines/su-27-flanker-cpp) follows the original game. [Su-27 Flanker Redux](https://github.com/Lost-Engines/su-27-flanker-redux) is where we can change the presentation and controls. Both grew out of this investigation.

The [source notes](../sources/) identify the working documents and link to the reconstruction’s validation results. You can explore the [models](../models/), [mission plans](../missions/) and [cockpit components](../cockpit/) here in the browser.
