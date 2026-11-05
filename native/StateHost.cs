using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

internal static class StateHost
{
    private const int ChunkSize = 512 * 1024;
    private const int MessageLimit = 16 * 1024 * 1024;

    private static void Main()
    {
        var serializer = new JavaScriptSerializer { MaxJsonLength = MessageLimit };
        using (var input = new BinaryReader(Console.OpenStandardInput()))
        using (var output = new BinaryWriter(Console.OpenStandardOutput()))
        {
            object response;
            try
            {
                int length = input.ReadInt32();
                if (length < 1 || length > MessageLimit)
                    throw new InvalidDataException();

                byte[] bytes = input.ReadBytes(length);
                if (bytes.Length != length)
                    throw new EndOfStreamException();

                var request = serializer.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(bytes));
                string path = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,
                    "..", "dark-new-tab-state.json"));
                response = ProcessRequest(serializer, request, path);
            }
            catch (Exception error)
            {
                Console.Error.WriteLine(error.GetType().Name);
                response = new { ok = false };
            }

            byte[] reply = Encoding.UTF8.GetBytes(serializer.Serialize(response));
            output.Write(reply.Length);
            output.Write(reply);
        }
    }

    private static object ProcessRequest(JavaScriptSerializer serializer, Dictionary<string, object> request, string path)
    {
        switch (request["action"] as string)
        {
            case "read":
                if (!File.Exists(path))
                    return new { missing = true };

                using (var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete))
                using (var reader = new BinaryReader(file))
                {
                    int offset = (int)request["offset"];
                    if (offset < 0 || offset > file.Length)
                        throw new InvalidDataException();

                    file.Position = offset;
                    byte[] chunk = reader.ReadBytes(ChunkSize);
                    return new { ok = true, chunk = Convert.ToBase64String(chunk), done = file.Position == file.Length };
                }

            case "write":
                var state = request["state"] as Dictionary<string, object>;
                if (state == null)
                    throw new InvalidDataException();

                string temporaryPath = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
                try
                {
                    File.WriteAllText(temporaryPath, serializer.Serialize(new { version = 1, state = state }) + "\n", new UTF8Encoding(false));
                    if (File.Exists(path))
                        File.Replace(temporaryPath, path, null);
                    else
                        File.Move(temporaryPath, path);
                }
                finally
                {
                    if (File.Exists(temporaryPath))
                        File.Delete(temporaryPath);
                }
                return new { ok = true };

            default:
                throw new InvalidDataException();
        }
    }
}
